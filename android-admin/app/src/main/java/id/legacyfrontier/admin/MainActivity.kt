package id.legacyfrontier.admin

import android.os.Bundle
import android.view.WindowManager
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.time.LocalDate

private data class AdminModule(
    val id: String,
    val title: String,
    val path: String,
    val arrayKey: String = "",
    val ownerOnly: Boolean = false
)

private val adminModules = listOf(
    AdminModule("orders", "Pesanan", "/api/admin/orders", "orders"),
    AdminModule("tickets", "Re-entry", "/api/admin/tickets", "tickets"),
    AdminModule("support", "Bantuan", "/api/admin/support", "tickets"),
    AdminModule("reviews", "Ulasan", "/api/admin/reviews", "reviews"),
    AdminModule("customers", "Pelanggan", "/api/admin/customers", "customers"),
    AdminModule("activity", "Aktivitas", "/api/admin/activity", "activities"),
    AdminModule("announcements", "Pengumuman", "/api/admin/announcements", "announcements"),
    AdminModule("notes", "Catatan tim", "/api/admin/notes", "notes"),
    AdminModule("products", "Produk", "/api/admin/products", "products", true),
    AdminModule("promos", "Promo", "/api/admin/promos", "promos", true),
    AdminModule("reports", "Laporan", "/api/admin/reports", ownerOnly = true),
    AdminModule("finance", "Keuangan", "/api/admin/finance", ownerOnly = true),
    AdminModule("site-content", "Konten web", "/api/admin/site-content", "items", true),
    AdminModule("studio", "SLF Studio", "/api/admin/site-design", ownerOnly = true),
    AdminModule("wiki-manager", "Perpustakaan Wiki", "/api/admin/wiki", ownerOnly = true),
    AdminModule("access", "Akses", "/api/admin/me", ownerOnly = true)
)

private data class ActionIntent(val action: String, val item: JSONObject)
private data class FormField(val key: String, val label: String, val initial: String = "")

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        window.addFlags(WindowManager.LayoutParams.FLAG_SECURE)
        setContent {
            val colors = darkColorScheme(
                primary = androidx.compose.ui.graphics.Color(0xFFB58CFF),
                secondary = androidx.compose.ui.graphics.Color(0xFFE8C98B),
                background = androidx.compose.ui.graphics.Color(0xFF100C18),
                surface = androidx.compose.ui.graphics.Color(0xFF1B1425)
            )
            MaterialTheme(colorScheme = colors) {
                Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
                    SLFAdminApp()
                }
            }
        }
    }
}

@Composable
private fun SLFAdminApp() {
    val context = androidx.compose.ui.platform.LocalContext.current
    val scope = rememberCoroutineScope()
    val api = remember { ApiClient() }

    var token by remember { mutableStateOf("") }
    var loginText by remember { mutableStateOf("") }
    var role by remember { mutableStateOf("") }
    var selectedId by remember { mutableStateOf("orders") }
    var payload by remember { mutableStateOf(JSONObject()) }
    var loading by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf("") }
    var notice by remember { mutableStateOf("") }
    var refreshTick by remember { mutableIntStateOf(0) }
    var actionIntent by remember { mutableStateOf<ActionIntent?>(null) }
    var actionText by remember { mutableStateOf("") }
    var actionStatus by remember { mutableStateOf("") }
    var showCreate by remember { mutableStateOf(false) }

    val module = adminModules.first { it.id == selectedId }
    val visibleModules = adminModules.filter { !it.ownerOnly || role == "owner" }

    suspend fun loadSelected() {
        if (token.isBlank()) return
        loading = true
        error = ""
        try {
            payload = api.request(module.path, token)
        } catch (e: Exception) {
            error = e.message ?: "Gagal memuat data."
            if (e is ApiException && e.status == 401) {
                SecureStore.clear(context)
                token = ""
                role = ""
            }
        } finally {
            loading = false
        }
    }

    LaunchedEffect(Unit) {
        val saved = SecureStore.load(context)
        if (!saved.isNullOrBlank()) {
            try {
                val auth = api.request("/api/admin/me", saved)
                val acceptedRole = auth.optString("role")
                if (acceptedRole == "owner" || acceptedRole == "admin") {
                    token = saved
                    role = acceptedRole
                } else {
                    SecureStore.clear(context)
                }
            } catch (e: Exception) {
                if (e is ApiException && e.status == 401) SecureStore.clear(context)
                else error = e.message ?: "Akses tersimpan belum dapat diverifikasi."
            }
        }
    }

    LaunchedEffect(token, selectedId, refreshTick) {
        if (token.isNotBlank()) loadSelected()
    }

    if (token.isBlank()) {
        LoginScreen(
            value = loginText,
            error = error,
            loading = loading,
            onValue = { loginText = it; error = "" },
            onLogin = {
                scope.launch {
                    loading = true
                    error = ""
                    try {
                        val auth = api.request("/api/admin/me", loginText.trim())
                        val acceptedRole = auth.optString("role")
                        if (acceptedRole != "owner" && acceptedRole != "admin") {
                            throw IllegalStateException("Kode akses tidak dikenali.")
                        }
                        SecureStore.save(context, loginText.trim())
                        token = loginText.trim()
                        role = acceptedRole
                        loginText = ""
                        notice = "Akses " + acceptedRole.uppercase() + " terverifikasi."
                    } catch (e: Exception) {
                        error = e.message ?: "Login gagal."
                    } finally {
                        loading = false
                    }
                }
            }
        )
        return
    }

    Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column {
                Text("SLF · RUANG OPERASIONAL", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text("Survival Legacy Frontier", style = MaterialTheme.typography.bodySmall)
            }
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(role.uppercase(), color = MaterialTheme.colorScheme.secondary, fontWeight = FontWeight.Bold)
                Spacer(Modifier.width(8.dp))
                TextButton(onClick = {
                    SecureStore.clear(context)
                    token = ""
                    role = ""
                    payload = JSONObject()
                    notice = "Sesi ditutup."
                }) { Text("Keluar") }
            }
        }

        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
            horizontalArrangement = Arrangement.spacedBy(7.dp)
        ) {
            visibleModules.forEach { item ->
                FilterChip(
                    selected = selectedId == item.id,
                    onClick = { selectedId = item.id; error = ""; notice = "" },
                    label = { Text(item.title) }
                )
            }
        }
        Spacer(Modifier.height(12.dp))

        if (module.id == "orders") StatsPanel(payload.optJSONObject("stats"))
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            Text(module.title, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            Row {
                if (supportsCreate(module.id)) {
                    TextButton(onClick = { showCreate = true }) { Text("Tambah") }
                }
                TextButton(onClick = { refreshTick += 1 }) { Text("Muat ulang") }
            }
        }

        if (notice.isNotBlank()) {
            Text(notice, color = MaterialTheme.colorScheme.secondary, style = MaterialTheme.typography.bodySmall)
        }
        if (error.isNotBlank()) {
            Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        if (loading) {
            Column(
                modifier = Modifier.fillMaxWidth().weight(1f),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.Center
            ) { CircularProgressIndicator() }
        } else {
            ModuleContent(
                module = module,
                payload = payload,
                onAction = { action ->
                    actionIntent = action
                    actionText = ""
                    actionStatus = if (action.action == "update-support") action.item.optString("status", "OPEN") else ""
                }
            )
        }
    }

    actionIntent?.let { intent ->
        ActionDialog(
            intent = intent,
            text = actionText,
            status = actionStatus,
            onText = { actionText = it },
            onStatus = { actionStatus = it },
            onDismiss = { actionIntent = null },
            onConfirm = {
                scope.launch {
                    loading = true
                    error = ""
                    try {
                        val id = intent.item.optString("id")
                        val body = JSONObject()
                        val path: String
                        when (intent.action) {
                            "verify-payment" -> {
                                path = "/api/admin/verify-payment"
                                body.put("orderId", intent.item.optString("id"))
                            }
                            "cancel-order" -> {
                                path = "/api/admin/cancel"
                                body.put("orderId", intent.item.optString("id"))
                            }
                            "process-order" -> {
                                path = "/api/admin/process"
                                body.put("orderId", intent.item.optString("id"))
                            }
                            "complete-order" -> {
                                path = "/api/admin/complete"
                                body.put("orderId", intent.item.optString("id"))
                            }
                            "complete-ticket", "reactivate-ticket" -> {
                                path = "/api/admin/ticket-status"
                                body.put("ticketId", id)
                                body.put("status", if (intent.action == "complete-ticket") "COMPLETED" else "ACTIVE")
                            }
                            "reply-review" -> {
                                path = "/api/admin/reviews"
                                body.put("orderId", intent.item.optString("order_id"))
                                body.put("reply", actionText.trim())
                                body.put("adminName", "Tim SLF")
                            }
                            "update-support" -> {
                                path = "/api/admin/support"
                                body.put("id", id)
                                body.put("status", actionStatus.trim().uppercase())
                                body.put("reply", actionText.trim())
                            }
                            else -> throw IllegalStateException("Aksi belum didukung.")
                        }
                        api.request(path, token, "POST", body)
                        actionIntent = null
                        notice = "Perubahan berhasil disimpan."
                        refreshTick += 1
                    } catch (e: Exception) {
                        error = e.message ?: "Aksi gagal."
                    } finally {
                        loading = false
                    }
                }
            }
        )
    }

    if (showCreate) {
        CreateDialog(
            moduleId = module.id,
            onDismiss = { showCreate = false },
            onSave = { body ->
                scope.launch {
                    loading = true
                    error = ""
                    try {
                        api.request(module.path, token, "POST", body)
                        showCreate = false
                        notice = "Data berhasil disimpan."
                        refreshTick += 1
                    } catch (e: Exception) {
                        error = e.message ?: "Gagal menyimpan data."
                    } finally {
                        loading = false
                    }
                }
            }
        )
    }
}

@Composable
private fun LoginScreen(
    value: String,
    error: String,
    loading: Boolean,
    onValue: (String) -> Unit,
    onLogin: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center
    ) {
        Text("SLF ADMIN", style = MaterialTheme.typography.headlineMedium, fontWeight = FontWeight.Bold)
        Text("Ruang operasional native Android", color = MaterialTheme.colorScheme.secondary)
        Spacer(Modifier.height(20.dp))
        OutlinedTextField(
            value = value,
            onValueChange = onValue,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("Kode akses Owner / Admin") },
            visualTransformation = PasswordVisualTransformation(),
            singleLine = true
        )
        Spacer(Modifier.height(12.dp))
        if (error.isNotBlank()) Text(error, color = MaterialTheme.colorScheme.error)
        Button(
            onClick = onLogin,
            enabled = value.isNotBlank() && !loading,
            modifier = Modifier.fillMaxWidth()
        ) {
            if (loading) CircularProgressIndicator()
            else Text("Masuk")
        }
        Spacer(Modifier.height(14.dp))
        Text(
            "Akses diverifikasi oleh server SLF. Kode disimpan terenkripsi menggunakan Android Keystore.",
            style = MaterialTheme.typography.bodySmall
        )
    }
}

@Composable
private fun StatsPanel(stats: JSONObject?) {
    if (stats == null) return
    val pairs = listOf(
        "Total order" to stats.optString("total", "0"),
        "Menunggu bayar" to stats.optString("pending", "0"),
        "Omzet terverifikasi" to ("Rp " + stats.optString("revenue", "0")),
        "Order hari ini" to stats.optString("today", "0")
    )
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        pairs.forEach { pair ->
            Card(
                modifier = Modifier.weight(1f),
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                shape = RoundedCornerShape(12.dp)
            ) {
                Column(modifier = Modifier.padding(9.dp)) {
                    Text(pair.first, style = MaterialTheme.typography.labelSmall)
                    Text(pair.second, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                }
            }
        }
    }
    Spacer(Modifier.height(8.dp))
}

@Composable
private fun ModuleContent(
    module: AdminModule,
    payload: JSONObject,
    onAction: (ActionIntent) -> Unit
) {
    val records = recordsFrom(payload, module.arrayKey)
    if (records.isEmpty()) {
        LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item { JsonCard(payload) }
            item {
                Text(
                    if (payload.length() == 0) "Belum ada data atau belum dimuat." else "Tidak ada baris untuk ditampilkan pada bagian ini.",
                    color = MaterialTheme.colorScheme.secondary
                )
            }
        }
        return
    }
    LazyColumn(modifier = Modifier.fillMaxSize(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        items(records) { item -> RecordCard(module, item, onAction) }
    }
}

@Composable
private fun RecordCard(
    module: AdminModule,
    item: JSONObject,
    onAction: (ActionIntent) -> Unit
) {
    val heading = listOf("product_name", "title", "subject", "name", "minecraft_name", "player_name", "code", "id")
        .firstNotNullOfOrNull { key ->
            item.optString(key).takeIf { it.isNotBlank() && it != "null" }
        } ?: module.title
    Card(
        modifier = Modifier.fillMaxWidth(),
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        shape = RoundedCornerShape(14.dp)
    ) {
        Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(heading, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
            item.keys().asSequence().forEach { key ->
                val value = item.opt(key)
                if (value != null && value !is JSONObject && value !is JSONArray && value != JSONObject.NULL) {
                    val text = value.toString()
                    if (text.isNotBlank()) {
                        Text(labelize(key) + ": " + text.take(240), style = MaterialTheme.typography.bodySmall)
                    }
                }
            }
            ActionRow(module, item, onAction)
        }
    }
}

@Composable
private fun ActionRow(
    module: AdminModule,
    item: JSONObject,
    onAction: (ActionIntent) -> Unit
) {
    val status = item.optString("status")
    Spacer(Modifier.height(2.dp))
    Row(horizontalArrangement = Arrangement.spacedBy(7.dp)) {
        when (module.id) {
            "orders" -> when (status) {
                "PENDING_PAYMENT" -> {
                    OutlinedButton(onClick = { onAction(ActionIntent("verify-payment", item)) }) { Text("Verifikasi") }
                    OutlinedButton(onClick = { onAction(ActionIntent("cancel-order", item)) }) { Text("Batalkan") }
                }
                "PAID" -> {
                    OutlinedButton(onClick = { onAction(ActionIntent("process-order", item)) }) { Text("Mulai proses") }
                    OutlinedButton(onClick = { onAction(ActionIntent("complete-order", item)) }) { Text("Selesai") }
                }
                "PROCESSING" -> OutlinedButton(onClick = { onAction(ActionIntent("complete-order", item)) }) { Text("Tandai selesai") }
            }
            "tickets" -> {
                if (status == "PENDING") OutlinedButton(onClick = { onAction(ActionIntent("complete-ticket", item)) }) { Text("Tandai selesai") }
                if (status == "PENDING" || status == "COMPLETED") OutlinedButton(onClick = { onAction(ActionIntent("reactivate-ticket", item)) }) { Text("Aktifkan") }
            }
            "reviews" -> OutlinedButton(onClick = { onAction(ActionIntent("reply-review", item)) }) { Text("Balas ulasan") }
            "support" -> OutlinedButton(onClick = { onAction(ActionIntent("update-support", item)) }) { Text("Tanggapi tiket") }
        }
    }
}

@Composable
private fun JsonCard(data: JSONObject) {
    if (data.length() == 0) return
    Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface)) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            data.keys().asSequence().forEach { key ->
                val value = data.opt(key)
                if (value != null && value != JSONObject.NULL) {
                    Text(labelize(key) + ": " + value.toString().take(900), style = MaterialTheme.typography.bodySmall)
                }
            }
        }
    }
}

@Composable
private fun ActionDialog(
    intent: ActionIntent,
    text: String,
    status: String,
    onText: (String) -> Unit,
    onStatus: (String) -> Unit,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit
) {
    val needsText = intent.action == "reply-review" || intent.action == "update-support"
    val message = when (intent.action) {
        "verify-payment" -> "Pastikan nominal dan transaksi masuk benar-benar cocok di DANA Bisnis. Screenshot bukti saja tidak cukup. Lanjutkan verifikasi pesanan ini?"
        "cancel-order" -> "Batalkan pesanan yang masih menunggu pembayaran? Pastikan pembayaran belum diterima."
        "process-order" -> "Mulai proses pesanan yang pembayarannya sudah terverifikasi?"
        "complete-order" -> "Pastikan produk benar-benar sudah diberikan kepada pemain sebelum menandai selesai."
        "complete-ticket" -> "Tandai permintaan re-entry ini selesai setelah proses manual benar-benar dilakukan?"
        "reactivate-ticket" -> "Pulihkan status tiket menjadi aktif?"
        "reply-review" -> "Tulis balasan untuk ulasan pemain."
        else -> "Perbarui status dan balasan tiket bantuan."
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Konfirmasi tindakan") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(message)
                if (needsText) {
                    if (intent.action == "update-support") {
                        OutlinedTextField(
                            value = status,
                            onValueChange = onStatus,
                            modifier = Modifier.fillMaxWidth(),
                            label = { Text("Status: OPEN / IN_PROGRESS / WAITING_PLAYER / RESOLVED / CLOSED") }
                        )
                    }
                    OutlinedTextField(
                        value = text,
                        onValueChange = onText,
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(if (intent.action == "reply-review") "Balasan ulasan" else "Balasan admin") },
                        minLines = 3
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onConfirm, enabled = !needsText || text.isNotBlank()) { Text("Lanjutkan") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } }
    )
}

@Composable
private fun CreateDialog(
    moduleId: String,
    onDismiss: () -> Unit,
    onSave: (JSONObject) -> Unit
) {
    val fields = remember(moduleId) { fieldsFor(moduleId) }
    val values = remember(moduleId) {
        mutableStateMapOf<String, String>().apply {
            fields.forEach { put(it.key, it.initial) }
        }
    }
    val title = when (moduleId) {
        "notes" -> "Catatan tim baru"
        "announcements" -> "Pengumuman baru"
        "products" -> "Produk Store"
        "promos" -> "Kode promo"
        "finance" -> "Catatan kas"
        "site-content" -> "Konten website"
        else -> "Tambah data"
    }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                items(fields) { field ->
                    OutlinedTextField(
                        value = values[field.key].orEmpty(),
                        onValueChange = { values[field.key] = it },
                        modifier = Modifier.fillMaxWidth(),
                        label = { Text(field.label) },
                        keyboardOptions = if (field.key in setOf("price", "amount", "value", "maxUses")) {
                            KeyboardOptions(keyboardType = KeyboardType.Number)
                        } else KeyboardOptions.Default,
                        minLines = if (field.key == "body" || field.key == "description") 2 else 1
                    )
                }
            }
        },
        confirmButton = {
            TextButton(onClick = { onSave(buildPayload(moduleId, values)) }) { Text("Simpan") }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } }
    )
}

private fun fieldsFor(moduleId: String): List<FormField> = when (moduleId) {
    "notes" -> listOf(
        FormField("title", "Judul"),
        FormField("category", "Kategori", "Operasional"),
        FormField("priority", "Prioritas: LOW / MEDIUM / HIGH", "MEDIUM"),
        FormField("body", "Isi catatan")
    )
    "announcements" -> listOf(FormField("title", "Judul"), FormField("body", "Isi pengumuman"))
    "products" -> listOf(
        FormField("id", "ID produk (huruf besar, angka, _)"),
        FormField("name", "Nama produk"),
        FormField("price", "Harga dalam Rupiah"),
        FormField("description", "Deskripsi"),
        FormField("tag", "Label", "Store"),
        FormField("note", "Catatan opsional")
    )
    "promos" -> listOf(
        FormField("code", "Kode promo"),
        FormField("type", "Jenis: percent / fixed", "percent"),
        FormField("value", "Nilai promo"),
        FormField("maxUses", "Batas penggunaan (kosong = tanpa batas)")
    )
    "finance" -> listOf(
        FormField("kind", "Jenis: INCOME / EXPENSE", "INCOME"),
        FormField("entryDate", "Tanggal YYYY-MM-DD", LocalDate.now().toString()),
        FormField("category", "Kategori", "Operasional lain"),
        FormField("amount", "Nominal Rupiah"),
        FormField("description", "Uraian"),
        FormField("reference", "Referensi opsional")
    )
    "site-content" -> listOf(
        FormField("kind", "Jenis: slot / card", "slot"),
        FormField("page", "Halaman: home / store / wiki", "home"),
        FormField("slotKey", "Slot teks, contoh home.lead", "home.lead"),
        FormField("title", "Judul kartu (wajib untuk card)"),
        FormField("body", "Isi konten"),
        FormField("imageUrl", "URL gambar HTTPS (opsional)")
    )
    else -> emptyList()
}

private fun buildPayload(moduleId: String, values: Map<String, String>): JSONObject {
    val body = JSONObject()
    values.forEach { (key, raw) ->
        val value = raw.trim()
        when (key) {
            "price", "amount", "value" -> body.put(key, value.toLongOrNull() ?: 0L)
            "maxUses" -> body.put(key, if (value.isBlank()) JSONObject.NULL else value.toIntOrNull() ?: 0)
            else -> body.put(key, value)
        }
    }
    if (moduleId == "announcements" || moduleId == "products" || moduleId == "promos" || moduleId == "site-content") {
        body.put("active", true)
    }
    if (moduleId == "site-content" && body.optString("kind") == "slot") {
        body.put("title", "")
        body.put("imageUrl", "")
    }
    return body
}

private fun supportsCreate(moduleId: String): Boolean =
    moduleId in setOf("notes", "announcements", "products", "promos", "finance", "site-content")

private fun recordsFrom(payload: JSONObject, preferredKey: String): List<JSONObject> {
    val array = payload.optJSONArray(preferredKey) ?: run {
        val keys = payload.keys()
        var found: JSONArray? = null
        while (keys.hasNext() && found == null) {
            val value = payload.opt(keys.next())
            if (value is JSONArray) found = value
        }
        found
    } ?: return emptyList()
    val list = ArrayList<JSONObject>()
    for (index in 0 until array.length()) {
        val item = array.optJSONObject(index)
        if (item != null) list.add(item)
    }
    return list
}

private fun labelize(value: String): String =
    value.replace('_', ' ').replace('-', ' ').replaceFirstChar { it.uppercase() }

package id.legacyfrontier.admin

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ApiException(val status: Int, message: String) : Exception(message)

class ApiClient(
    private val baseUrl: String = "https://legacy-frontier.web.id"
) {
    suspend fun request(
        path: String,
        secret: String,
        method: String = "GET",
        body: JSONObject? = null
    ): JSONObject = withContext(Dispatchers.IO) {
        val connection = URL(baseUrl.trimEnd('/') + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 15000
            connection.readTimeout = 25000
            connection.useCaches = false
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Cache-Control", "no-store")
            connection.setRequestProperty("Authorization", "Bearer " + secret)
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { stream ->
                    stream.write(body.toString().toByteArray(Charsets.UTF_8))
                }
            }

            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val raw = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            val json = try {
                if (raw.isBlank()) JSONObject() else JSONObject(raw)
            } catch (_: Exception) {
                JSONObject().put("error", "Server mengirim respons yang tidak dapat dibaca.")
            }
            if (status !in 200..299) {
                throw ApiException(status, json.optString("error").ifBlank { "Permintaan gagal (HTTP " + status + ")." })
            }
            json
        } finally {
            connection.disconnect()
        }
    }
}

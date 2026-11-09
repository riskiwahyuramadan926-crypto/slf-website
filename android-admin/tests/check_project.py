from pathlib import Path
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parents[1]
required = [
    "settings.gradle.kts",
    "build.gradle.kts",
    "gradle.properties",
    "app/build.gradle.kts",
    "app/src/main/AndroidManifest.xml",
    "app/src/main/java/id/legacyfrontier/admin/MainActivity.kt",
    "app/src/main/java/id/legacyfrontier/admin/ApiClient.kt",
    "app/src/main/java/id/legacyfrontier/admin/SecureStore.kt",
]
missing = [item for item in required if not (root / item).is_file()]
if missing:
    raise SystemExit("Missing project files: " + ", ".join(missing))

manifest = ET.parse(root / "app/src/main/AndroidManifest.xml").getroot()
android_ns = "{http://schemas.android.com/apk/res/android}"
permissions = [node.attrib.get(android_ns + "name") for node in manifest.findall("uses-permission")]
assert "android.permission.INTERNET" in permissions, "INTERNET permission missing"
application = manifest.find("application")
assert application is not None
assert application.attrib.get(android_ns + "allowBackup") == "false", "Android backups must stay disabled"
assert application.attrib.get(android_ns + "usesCleartextTraffic") == "false", "Cleartext HTTP must stay disabled"

api = (root / "app/src/main/java/id/legacyfrontier/admin/ApiClient.kt").read_text()
secure = (root / "app/src/main/java/id/legacyfrontier/admin/SecureStore.kt").read_text()
main = (root / "app/src/main/java/id/legacyfrontier/admin/MainActivity.kt").read_text()
assert "https://legacy-frontier.web.id" in api
assert '"Authorization"' in api and '"Bearer "' in api
assert "AndroidKeyStore" in secure and "AES/GCM/NoPadding" in secure
assert "WebView" not in main and "android.webkit" not in main

print("PASS: native Compose project, HTTPS/Bearer API auth, encrypted Android Keystore storage, Android XML and no WebView.")

plugins { id("com.android.application"); id("org.jetbrains.kotlin.android") }
val webOrigin = providers.gradleProperty("webOrigin").orElse("https://algostep.invalid").get()
require(webOrigin.matches(Regex("https://[a-zA-Z0-9.-]+(:[0-9]+)?"))) { "webOrigin must be an HTTPS origin without a path" }
android {
    namespace = "com.algostep.app"
    compileSdk = 35
    defaultConfig {
        applicationId = "com.algostep.app"
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.2.0"
        buildConfigField("String", "WEB_ORIGIN", "\"$webOrigin\"")
    }
    buildFeatures { buildConfig = true }
    compileOptions { sourceCompatibility = JavaVersion.VERSION_17; targetCompatibility = JavaVersion.VERSION_17 }
    kotlinOptions { jvmTarget = "17" }
}
dependencies {
    implementation("androidx.activity:activity-ktx:1.10.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.9.0")
    implementation("androidx.webkit:webkit:1.13.0")
    implementation("androidx.credentials:credentials:1.5.0")
    implementation("androidx.credentials:credentials-play-services-auth:1.5.0")
    implementation("com.google.android.libraries.identity.googleid:googleid:1.1.1")
    testImplementation("junit:junit:4.13.2")
}

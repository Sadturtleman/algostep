package com.algostep.app

import android.annotation.SuppressLint
import android.os.Bundle
import android.graphics.Color
import android.net.Uri
import android.webkit.*
import android.widget.*
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.credentials.*
import androidx.lifecycle.lifecycleScope
import androidx.webkit.WebViewCompat
import androidx.webkit.WebViewFeature
import com.google.android.libraries.identity.googleid.*
import kotlinx.coroutines.launch
import org.json.JSONObject

class MainActivity : ComponentActivity() {
    private lateinit var web: WebView
    private lateinit var root: FrameLayout
    private var signingIn = false
    private fun trusted(uri: Uri) = uri.scheme == "https" && uri.authority == Uri.parse(BuildConfig.WEB_ORIGIN).authority

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        root = FrameLayout(this)
        setContentView(root)
        web = WebView(this)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            userAgentString += " AlgostepAndroid/1"
        }
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, false)
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest) = !trusted(request.url)
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (request.isForMainFrame) showError("연결할 수 없어요. 네트워크 상태를 확인해 주세요.")
            }
            override fun onReceivedHttpError(view: WebView, request: WebResourceRequest, response: WebResourceResponse) {
                if (request.isForMainFrame) showError("서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.")
            }
            // Default SSL handling cancels; never proceed past an invalid certificate.
        }
        if (!WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)) {
            showError("Android System WebView를 업데이트한 뒤 다시 열어 주세요.")
            return
        }
        WebViewCompat.addWebMessageListener(web, "AlgostepNative", setOf(BuildConfig.WEB_ORIGIN)) { _, message, origin, mainFrame, reply ->
            if (!mainFrame || !trusted(origin)) return@addWebMessageListener
            val data = try { JSONObject(message.data ?: "") } catch (_: Exception) { return@addWebMessageListener }
            if (data.optString("type") == "logout") {
                lifecycleScope.launch { try { CredentialManager.create(this@MainActivity).clearCredentialState(ClearCredentialStateRequest()) } catch (_: Exception) {} }
            } else if (data.optString("type") == "login" && !signingIn) {
                val nonce = data.optString("nonce")
                val client = data.optString("clientId")
                if (!nonce.matches(Regex("[a-f0-9]{64}")) || !client.endsWith(".apps.googleusercontent.com")) return@addWebMessageListener
                signingIn = true
                lifecycleScope.launch {
                    try {
                        val option = GetSignInWithGoogleOption.Builder(client).setNonce(nonce).build()
                        val request = GetCredentialRequest.Builder().addCredentialOption(option).build()
                        val result = CredentialManager.create(this@MainActivity).getCredential(this@MainActivity, request)
                        val credential = GoogleIdTokenCredential.createFrom(result.credential.data)
                        reply.postMessage(JSONObject().put("credential", credential.idToken).toString())
                    } catch (_: Exception) { reply.postMessage("{\"error\":\"로그인이 취소되었거나 연결할 수 없어요. 다시 시도해 주세요.\"}") }
                    finally { signingIn = false }
                }
            }
        }
        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() { if (web.canGoBack()) web.goBack() else finish() }
        })
        load()
    }
    private fun load() {
        root.removeAllViews()
        root.addView(web)
        web.loadUrl(BuildConfig.WEB_ORIGIN)
    }
    private fun showError(message: String) {
        val layout = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL; gravity = android.view.Gravity.CENTER; setPadding(48,48,48,48); setBackgroundColor(Color.rgb(246,247,251)) }
        layout.addView(TextView(this).apply { text = "Algostep\n\n$message"; textSize = 20f; setTextColor(Color.rgb(24,33,58)) })
        layout.addView(Button(this).apply { text = "다시 연결"; setOnClickListener { load() } })
        root.removeAllViews(); root.addView(layout)
    }
    override fun onDestroy() { root.removeAllViews(); web.destroy(); super.onDestroy() }
}

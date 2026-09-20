package app.manar.islamic;

import android.app.Activity;
import android.graphics.Color;
import android.graphics.Typeface;
import android.os.Build;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import com.getcapacitor.Bridge;
import com.getcapacitor.BridgeWebViewClient;

/**
 * منار — تشخيص فشل تحميل الواجهة داخل WebView.
 *
 * بدون هذا الملف يعرض WebView صفحته الإنجليزية البيضاء ("This page didn't
 * load") بلا رمز خطأ مفيد، فيصبح تشخيص فشل يظهر على الجهاز فقط تخمينًا. الآن كل
 * فشل في الإطار الرئيسي يُسجَّل في logcat بوسم {@code ManarBoot} ويُعرض للمستخدم
 * بالعربية مع رمز الخطأ والعنوان وزر إعادة المحاولة.
 */
final class ManarWebViewDiagnostics extends BridgeWebViewClient {

    private static final String TAG = "ManarBoot";
    private final Activity activity;
    private final Bridge bridge;
    private boolean recoveredFromRendererLoss = false;

    ManarWebViewDiagnostics(Bridge bridge, Activity activity) {
        super(bridge);
        this.bridge = bridge;
        this.activity = activity;
    }

    @Override
    public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
        super.onReceivedError(view, request, error);
        if (request == null || !request.isForMainFrame()) return;

        int code = 0;
        CharSequence description = "";
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M && error != null) {
            code = error.getErrorCode();
            description = error.getDescription();
        }
        String url = request.getUrl() != null ? request.getUrl().toString() : "?";
        Log.e(TAG, "main frame failed: code=" + code + " desc=" + description + " url=" + url);
        show("رمز الخطأ: " + code + "\n" + description + "\n" + url);
    }

    @Override
    public void onReceivedHttpError(
        WebView view,
        WebResourceRequest request,
        android.webkit.WebResourceResponse response
    ) {
        super.onReceivedHttpError(view, request, response);
        if (request == null || !request.isForMainFrame()) return;
        int status = response != null ? response.getStatusCode() : 0;
        String url = request.getUrl() != null ? request.getUrl().toString() : "?";
        Log.e(TAG, "main frame http error: status=" + status + " url=" + url);
        show("استجابة HTTP: " + status + "\n" + url);
    }

    /**
     * انهيار مُحرِّك عرض WebView (نقص ذاكرة أو تعطّل داخلي). بدون هذه المعالجة
     * يبقى التطبيق على صفحة بيضاء ميتة، أو يُسقط النظام العملية بالكامل.
     * نُعيد التحميل مرة واحدة، وإن تكرّر نعرض لوحة التشخيص.
     */
    @Override
    public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
        boolean crashed = Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && detail != null && detail.didCrash();
        Log.e(TAG, "render process gone: didCrash=" + crashed + " recoveredOnce=" + recoveredFromRendererLoss);

        if (view != null) {
            ViewGroup parent = (ViewGroup) view.getParent();
            if (parent != null) parent.removeView(view);
            view.destroy();
        }

        if (!recoveredFromRendererLoss && bridge != null) {
            recoveredFromRendererLoss = true;
            activity.runOnUiThread(activity::recreate);
        } else {
            show("انهيار مُحرِّك عرض الصفحة" + (crashed ? " (تعطّل)" : " (نقص ذاكرة)"));
        }
        return true;
    }

    /** لوحة عربية أصلية تحلّ محلّ صفحة الخطأ الإنجليزية الفارغة. */
    private void show(final String details) {
        activity.runOnUiThread(() -> {
            try {
                ViewGroup root = activity.findViewById(android.R.id.content);
                if (root == null || root.findViewWithTag("manar_boot_error") != null) return;

                FrameLayout overlay = new FrameLayout(activity);
                overlay.setTag("manar_boot_error");
                overlay.setBackgroundColor(Color.parseColor("#0B1F1A"));
                overlay.setLayoutParams(
                    new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                );

                LinearLayout box = new LinearLayout(activity);
                box.setOrientation(LinearLayout.VERTICAL);
                box.setGravity(Gravity.CENTER);
                int pad = (int) (24 * activity.getResources().getDisplayMetrics().density);
                box.setPadding(pad, pad, pad, pad);
                box.setLayoutParams(
                    new FrameLayout.LayoutParams(
                        ViewGroup.LayoutParams.MATCH_PARENT,
                        ViewGroup.LayoutParams.MATCH_PARENT
                    )
                );

                TextView title = new TextView(activity);
                title.setText("تعذّر تحميل واجهة منار");
                title.setTextColor(Color.parseColor("#C9A227"));
                title.setTextSize(20f);
                title.setTypeface(Typeface.DEFAULT_BOLD);
                title.setGravity(Gravity.CENTER);

                TextView body = new TextView(activity);
                body.setText("أرسل هذه التفاصيل للمطوّر:\n\n" + details);
                body.setTextColor(Color.parseColor("#F8F9FA"));
                body.setTextSize(13f);
                body.setGravity(Gravity.CENTER);
                body.setPadding(0, pad / 2, 0, pad);
                body.setTextIsSelectable(true);

                Button retry = new Button(activity);
                retry.setText("إعادة المحاولة");
                retry.setOnClickListener((View v) -> {
                    root.removeView(overlay);
                    if (bridge != null && bridge.getWebView() != null) {
                        bridge.getWebView().reload();
                    }
                });

                box.addView(title);
                box.addView(body);
                box.addView(retry);
                overlay.addView(box);
                root.addView(overlay);
            } catch (Throwable t) {
                Log.e(TAG, "could not show the diagnostics overlay", t);
            }
        });
    }
}

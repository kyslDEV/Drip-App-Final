package com.driptest.offline;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.RectF;
import android.graphics.Typeface;
import android.graphics.pdf.PdfDocument;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.print.PrintAttributes;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

public class MainActivity extends Activity {
    private static final String HOME_URL = "file:///android_asset/www/index.html";
    private static final int NOTIFICATION_PERMISSION_REQUEST = 2001;

    private WebView webView;
    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    @SuppressLint({"SetJavaScriptEnabled", "ObsoleteSdkInt"})
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        DripNotificationReceiver.ensureNotificationChannel(this);
        requestNotificationPermissionIfNeeded();

        webView = new WebView(this);
        webView.setLayoutParams(new ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT
        ));
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(true);

        webView.setBackgroundColor(Color.WHITE);
        webView.addJavascriptInterface(new AndroidBridge(), "AndroidBridge");
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            private boolean handleUrl(String url) {
                if (url == null || url.isEmpty()) {
                    return false;
                }

                if (url.startsWith("file:///android_asset/www/")
                        || url.startsWith("about:blank")
                        || url.startsWith("data:")
                        || url.startsWith("blob:")
                        || url.startsWith("file://")) {
                    return false;
                }

                if (url.startsWith("http://")
                        || url.startsWith("https://")
                        || url.startsWith("intent://")
                        || url.startsWith("market://")
                        || url.startsWith("whatsapp://")) {
                    try {
                        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                        startActivity(intent);
                    } catch (Exception ignored) {
                        // Keep the app stable if the target handler is missing.
                    }
                    return true;
                }

                return false;
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                if (request == null || request.getUrl() == null) {
                    return false;
                }
                return handleUrl(request.getUrl().toString());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleUrl(url);
            }
        });

        if (savedInstanceState == null) {
            webView.loadUrl(HOME_URL);
        } else {
            webView.restoreState(savedInstanceState);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (webView != null) {
            webView.saveState(outState);
        }
    }

    @SuppressLint("GestureBackNavigation")
    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (webView != null) {
            webView.removeJavascriptInterface("AndroidBridge");
            webView.destroy();
            webView = null;
        }
    }

    private void requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT < 33) {
            return;
        }
        if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) == android.content.pm.PackageManager.PERMISSION_GRANTED) {
            return;
        }
        requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, NOTIFICATION_PERMISSION_REQUEST);
    }

    private PendingIntent buildReminderPendingIntent(String reminderId, String title, String text) {
        Intent intent = new Intent(this, DripNotificationReceiver.class);
        intent.setAction("com.driptest.offline.REMINDER");
        intent.putExtra("reminderId", reminderId);
        intent.putExtra("title", title);
        intent.putExtra("text", text);
        return PendingIntent.getBroadcast(
                this,
                reminderId.hashCode(),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
    }

    private void scheduleReminder(String reminderId, long triggerAt, String title, String text) {
        AlarmManager alarmManager = getSystemService(AlarmManager.class);
        if (alarmManager == null) {
            throw new IllegalStateException("AlarmManager indisponivel.");
        }

        PendingIntent pendingIntent = buildReminderPendingIntent(reminderId, title, text);
        if (Build.VERSION.SDK_INT >= 23) {
            alarmManager.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        } else {
            alarmManager.setExact(AlarmManager.RTC_WAKEUP, triggerAt, pendingIntent);
        }
    }

    private void cancelReminder(String reminderId) {
        AlarmManager alarmManager = getSystemService(AlarmManager.class);
        if (alarmManager == null) {
            return;
        }
        PendingIntent pendingIntent = buildReminderPendingIntent(reminderId, "", "");
        alarmManager.cancel(pendingIntent);
        pendingIntent.cancel();
    }

    private File ensurePdfTarget(String filename) throws IOException {
        File baseDir = getExternalFilesDir(android.os.Environment.DIRECTORY_DOCUMENTS);
        if (baseDir == null) {
            baseDir = new File(getFilesDir(), "documents");
        }
        File dripDir = new File(baseDir, "DripTest");
        if (!dripDir.exists() && !dripDir.mkdirs()) {
            throw new IOException("Nao foi possivel criar a pasta de documentos.");
        }
        return new File(dripDir, filename);
    }

    private void notifyJs(final JSONObject payload) {
        if (webView == null) {
            return;
        }
        final String escaped = JSONObject.quote(payload.toString());
        webView.post(new Runnable() {
            @Override
            public void run() {
                if (webView != null) {
                    webView.evaluateJavascript("window.__dripNativeComplete && window.__dripNativeComplete(" + escaped + ");", null);
                }
            }
        });
    }

    private void launchPdfIntent(File pdfFile, boolean share, boolean open, String text) {
        Uri uri = FileProvider.getUriForFile(
                this,
                getPackageName() + ".fileprovider",
                pdfFile
        );

        if (share) {
            Intent shareIntent = new Intent(Intent.ACTION_SEND);
            shareIntent.setType("application/pdf");
            shareIntent.putExtra(Intent.EXTRA_STREAM, uri);
            if (text != null && !text.isEmpty()) {
                shareIntent.putExtra(Intent.EXTRA_TEXT, text);
            }
            shareIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            startActivity(Intent.createChooser(shareIntent, "Compartilhar PDF"));
            return;
        }

        if (open) {
            Intent viewIntent = new Intent(Intent.ACTION_VIEW);
            viewIntent.setDataAndType(uri, "application/pdf");
            viewIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            viewIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(Intent.createChooser(viewIntent, "Abrir PDF"));
        }
    }

    private void renderHtmlToPdf(
            final String requestId,
            final String filename,
            final String html,
            final String title,
            final boolean share,
            final boolean open,
            final String text,
            final boolean landscape
    ) {
        final WebView printWebView = new WebView(this);
        WebSettings settings = printWebView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setDomStorageEnabled(true);
        printWebView.setBackgroundColor(Color.WHITE);
        printWebView.setVisibility(View.VISIBLE);
        printWebView.setX(-10000f);
        printWebView.setY(0f);

        final ViewGroup decorView = (ViewGroup) getWindow().getDecorView();
        int previewWidth = landscape ? 1600 : getResources().getDisplayMetrics().widthPixels;
        decorView.addView(printWebView, new ViewGroup.LayoutParams(
                previewWidth,
                Math.max(1200, getResources().getDisplayMetrics().heightPixels)
        ));

        printWebView.setWebViewClient(new WebViewClient() {
            private boolean started;

            @Override
            public void onPageFinished(WebView view, String url) {
                if (started) {
                    return;
                }
                started = true;
                printWebView.postVisualStateCallback(System.currentTimeMillis(), new WebView.VisualStateCallback() {
                    @Override
                    public void onComplete(long requestIdVisual) {
                        mainHandler.postDelayed(new Runnable() {
                            @Override
                            public void run() {
                                readContentHeightAndWritePdf(requestId, filename, title, share, open, text, landscape, printWebView);
                            }
                        }, 150L);
                    }
                });
            }
        });

        printWebView.loadDataWithBaseURL("file:///android_asset/www/", html, "text/html", "utf-8", null);
    }

    private void readContentHeightAndWritePdf(
            final String requestId,
            final String filename,
            final String title,
            final boolean share,
            final boolean open,
            final String text,
            final boolean landscape,
            final WebView printWebView
    ) {
        String script = "(function(){var b=document.body,d=document.documentElement;"
                + "return Math.ceil(Math.max("
                + "b?b.scrollHeight:0,d?d.scrollHeight:0));})()";
        printWebView.evaluateJavascript(script, new android.webkit.ValueCallback<String>() {
            @Override
            public void onReceiveValue(String value) {
                writePdfFromWebView(
                        requestId,
                        filename,
                        title,
                        share,
                        open,
                        text,
                        landscape,
                        parseJsInteger(value),
                        printWebView
                );
            }
        });
    }

    private int parseJsInteger(String value) {
        if (value == null) {
            return 0;
        }
        try {
            return Math.max(0, (int) Math.ceil(Double.parseDouble(value.replace("\"", ""))));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private void disposePrintWebView(WebView printWebView) {
        if (printWebView == null) {
            return;
        }
        ViewGroup parent = (ViewGroup) printWebView.getParent();
        if (parent != null) {
            parent.removeView(printWebView);
        }
        printWebView.destroy();
    }

    private void writePdfFromWebView(
            final String requestId,
            final String filename,
            final String title,
            final boolean share,
            final boolean open,
            final String text,
            final boolean landscape,
            final int contentHeightCss,
            final WebView printWebView
    ) {
        final File pdfFile;
        try {
            pdfFile = ensurePdfTarget(filename);
        } catch (IOException error) {
            notifyJs(buildErrorPayload(requestId, error.getMessage()));
            disposePrintWebView(printWebView);
            return;
        }

        try {
            int measureWidth = landscape ? 1600 : getResources().getDisplayMetrics().widthPixels;
            int widthSpec = View.MeasureSpec.makeMeasureSpec(measureWidth, View.MeasureSpec.EXACTLY);
            int previewHeight = Math.max(1200, getResources().getDisplayMetrics().heightPixels);
            int heightSpec = View.MeasureSpec.makeMeasureSpec(previewHeight, View.MeasureSpec.EXACTLY);
            printWebView.measure(widthSpec, heightSpec);
            printWebView.layout(0, 0, printWebView.getMeasuredWidth(), previewHeight);
            printWebView.invalidate();

            PdfDocument document = new PdfDocument();
            int pageWidth = landscape ? 842 : 595;
            int pageHeight = landscape ? 595 : 842;
            int contentWidth = Math.max(printWebView.getMeasuredWidth(), 1);
            int jsHeight = Math.round(contentHeightCss * printWebView.getScale());
            int webViewHeight = Math.round(printWebView.getContentHeight() * printWebView.getScale());
            int contentHeight = Math.max(pageHeight, jsHeight > 0 ? jsHeight : webViewHeight);
            if (contentHeight <= 0) {
                contentHeight = previewHeight;
            }
            float scale = (float) pageWidth / (float) contentWidth;
            int viewportHeight = Math.max(1, (int) Math.ceil((double) pageHeight / (double) scale));
            int pageCount = Math.max(1, (int) Math.ceil((double) contentHeight / (double) viewportHeight));
            printWebView.layout(0, 0, contentWidth, viewportHeight);

            for (int pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
                PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(pageWidth, pageHeight, pageIndex + 1).create();
                PdfDocument.Page page = document.startPage(pageInfo);
                Canvas canvas = page.getCanvas();
                canvas.drawColor(Color.WHITE);
                canvas.save();
                canvas.scale(scale, scale);
                printWebView.scrollTo(0, pageIndex * viewportHeight);
                printWebView.draw(canvas);
                canvas.restore();
                document.finishPage(page);
            }
            printWebView.scrollTo(0, 0);

            FileOutputStream outputStream = new FileOutputStream(pdfFile, false);
            document.writeTo(outputStream);
            outputStream.flush();
            outputStream.close();
            document.close();
            disposePrintWebView(printWebView);

            launchPdfIntent(pdfFile, share, open, text);
            JSONObject payload = new JSONObject();
            payload.put("requestId", requestId);
            payload.put("ok", true);
            payload.put("title", title);
            payload.put("path", pdfFile.getAbsolutePath());
            notifyJs(payload);
        } catch (Exception error) {
            disposePrintWebView(printWebView);
            notifyJs(buildErrorPayload(requestId, error.getMessage()));
        }
    }

    private void writeNativeReportPdf(
            final String requestId,
            final String filename,
            final JSONObject report,
            final JSONObject user,
            final String reportNumber,
            final String hash,
            final String sourceLabel,
            final String issuedAt,
            final String title,
            final boolean share,
            final boolean open,
            final String text
    ) {
        try {
            File pdfFile = ensurePdfTarget(filename);
            NativeReportPdfWriter writer = new NativeReportPdfWriter(
                    "Documento gerado pelo DripTest. Laudo " + dash(reportNumber) + "."
            );

            JSONObject laudo = report.optJSONObject("laudo");
            JSONObject trace = laudo == null ? null : laudo.optJSONObject("traceability");
            JSONObject totals = report.optJSONObject("totals");
            JSONObject metadata = report.optJSONObject("metadata");
            JSONArray lotSummaries = report.optJSONArray("lotSummaries");
            JSONArray initialRecords = report.optJSONArray("initialRecords");
            JSONArray finalizedRecords = report.optJSONArray("finalizedRecords");
            JSONArray absorptionTests = report.optJSONArray("absorptionTests");

            String effectiveTitle = stringOr(title, "Laudo DripTest");
            String generatedAt = firstNonEmpty(
                    formatDateValue(issuedAt),
                    formatDateValue(report.opt("generatedAt")),
                    formatDateValue(System.currentTimeMillis())
            );
            String shortHash = hash == null || hash.trim().isEmpty()
                    ? "-"
                    : (hash.length() > 12 ? hash.substring(0, 12) + "..." : hash);
            String lots = firstNonEmpty(userString(user, "lot"), joinJsonArray(trace, "lots"));
            String plants = firstNonEmpty(userString(user, "sectorName"), userString(user, "plantName"), joinJsonArray(trace, "plants"));
            String shifts = firstNonEmpty(userString(user, "shift"), userString(user, "turno"), joinJsonArray(trace, "shifts"));
            String fabDates = firstNonEmpty(userString(user, "fabDate"), joinJsonArray(trace, "fabricationDates"));
            String monitors = firstNonEmpty(userString(user, "monitorName"), userString(user, "monitor"), joinJsonArray(trace, "monitors"));
            String brands = joinJsonArray(trace, "brands");
            String species = joinJsonArray(trace, "species");

            writer.title("LAUDO TÉCNICO DE ANÁLISE DE GOTEJAMENTO", effectiveTitle);
            writer.keyValueGrid(new String[][]{
                    {"Número do laudo", dash(reportNumber)},
                    {"Gerado em", generatedAt},
                    {"Lote", dash(lots)},
                    {"Setor da análise", dash(plants)},
                    {"Turno", dash(shifts)},
                    {"Data fabricação", dash(fabDates)},
                    {"Monitor(a)", dash(monitors)},
                    {"Marca(s) do produto", dash(brands)},
                    {"Espécie(s)", dash(species)},
                    {"Hash SHA-256", shortHash},
                    {"Origem", stringOr(sourceLabel, "App Android DripTest")}
            });

            writer.sectionTitle("Identificação e método");
            writer.twoColumnBoxes(
                    "Objetivo\n" + stringOr(jsonString(laudo, "objective"), "Registrar e consolidar pesagens iniciais e finais para avaliação técnica.")
                            + "\n\nMétodo\n" + stringOr(jsonString(laudo, "method"), "Pesagem inicial, cálculo do tempo previsto e pesagem final.")
                            + "\n\nEscopo\nConsolidação das amostras, rastreabilidade operacional, cálculo do drip médio por lote e indicadores para avaliação comercial.",
                    "Rastreabilidade ativa\n"
                            + "Lote(s): " + dash(joinJsonArray(trace, "lots")) + "\n"
                            + "Setor(es): " + dash(joinJsonArray(trace, "plants")) + "\n"
                            + "Turno(s): " + dash(joinJsonArray(trace, "shifts")) + "\n"
                            + "Espécie(s): " + dash(joinJsonArray(trace, "species")) + "\n"
                            + "Monitor(es): " + dash(joinJsonArray(trace, "monitors")) + "\n"
                            + "Fabricação: " + dash(joinJsonArray(trace, "fabricationDates"))
            );

            writer.sectionTitle("Resumo executivo");
            writer.cards(new String[][]{
                    {"Amostras", numberText(totals, "initialRecords", "0")},
                    {"Finalizadas", numberText(totals, "finalizedRecords", "0")},
                    {"Perda total", gramText(totals, "totalLossAbs")},
                    {"Perda média", percentText(totals, "averageLossPct")}
            });

            writer.sectionTitle("Resultados consolidados");
            writer.bullets(new String[]{
                    "Registros iniciais: " + numberText(totals, "initialRecords", "0"),
                    "Registros finalizados: " + numberText(totals, "finalizedRecords", "0"),
                    "Registros pendentes: " + numberText(totals, "pendingRecords", "0"),
                    "Lotes únicos: " + numberText(totals, "lots", "0"),
                    "Setores únicos: " + numberText(totals, "plants", "0"),
                    "Turnos únicos: " + numberText(totals, "shifts", "0"),
                    "Marcas únicas: " + numberText(totals, "brands", "0"),
                    "Tempo total: " + minuteText(totals, "totalTimeMin"),
                    "Peso bruto total: " + gramText(totals, "totalGross"),
                    "Peso líquido inicial total: " + gramText(totals, "totalNetInitial"),
                    "Peso líquido final total: " + gramText(totals, "totalFinalNet"),
                    "Absorção total: " + gramText(totals, "totalLossAbs")
            });

            writer.sectionTitle("Rastreabilidade e auditoria");
            writer.keyValueGrid(new String[][]{
                    {"Versão do store", jsonString(metadata, "storeVersion")},
                    {"Hash SHA-256 do laudo", dash(hash)},
                    {"Atualizado em", formatDateValue(metadata == null ? null : metadata.opt("updatedAt"))},
                    {"Primeiro cadastro", formatDateValue(metadata == null ? null : metadata.opt("firstCreatedAt"))},
                    {"Último cadastro", formatDateValue(metadata == null ? null : metadata.opt("lastCreatedAt"))},
                    {"Primeira finalização", formatDateValue(metadata == null ? null : metadata.opt("firstFinalAt"))},
                    {"Última finalização", formatDateValue(metadata == null ? null : metadata.opt("lastFinalAt"))},
                    {"Registros interpolados", numberText(totals, "interpolatedRecords", "0")},
                    {"Registros sem tempo calculado", numberText(totals, "recordsWithoutTime", "0")},
                    {"Avisos de mercado", numberText(totals, "marketWarnings", "0")}
            });

            writer.sectionTitle("Resumo por lote");
            writer.table(
                    new String[]{"Lote", "Reg.", "Drip médio", "Sugestão", "Auditoria"},
                    lotRows(lotSummaries),
                    new float[]{2.1f, 0.7f, 1.2f, 1.8f, 1.5f},
                    7.4f
            );

            writer.sectionTitle("Conclusão");
            writer.callout(buildConclusion(report, totals));

            writer.sectionTitle("Matriz analítica de pesagens iniciais");
            writer.table(
                    new String[]{"#", "ID", "Espécie/Marca", "Lote", "Setor", "Monitor", "Bruto", "Líquido", "Tempo", "Status"},
                    initialRows(initialRecords),
                    new float[]{0.4f, 1.1f, 1.6f, 1.0f, 1.2f, 1.2f, 0.8f, 0.8f, 0.8f, 0.8f},
                    6.8f
            );

            writer.sectionTitle("Matriz auditável de pesagens finalizadas");
            writer.table(
                    new String[]{"#", "ID", "Lote", "Marca", "Monitor", "Bruto ini.", "Bruto final", "Líq. final", "Drip %", "Sugestão"},
                    finalizedRows(finalizedRecords),
                    new float[]{0.4f, 1.1f, 1.0f, 1.2f, 1.1f, 0.9f, 0.9f, 0.9f, 0.9f, 1.4f},
                    6.8f
            );

            writer.sectionTitle("Testes complementares de absorção");
            writer.table(
                    new String[]{"#", "ID", "Espécie/Marca", "Lote", "Base", "Inicial", "Final", "Seco", "Abs.", "%", "Nota"},
                    absorptionRows(absorptionTests),
                    new float[]{0.4f, 1.1f, 1.5f, 1.0f, 0.9f, 0.8f, 0.8f, 0.8f, 0.8f, 0.7f, 1.6f},
                    6.6f
            );

            writer.writeTo(pdfFile);
            launchPdfIntent(pdfFile, share, open, text);

            JSONObject payload = new JSONObject();
            payload.put("requestId", requestId);
            payload.put("ok", true);
            payload.put("title", title);
            payload.put("path", pdfFile.getAbsolutePath());
            notifyJs(payload);
        } catch (Exception error) {
            notifyJs(buildErrorPayload(requestId, error.getMessage()));
        }
    }

    private List<String[]> lotRows(JSONArray rows) {
        List<String[]> result = new ArrayList<>();
        if (rows != null) {
            for (int i = 0; i < rows.length(); i += 1) {
                JSONObject item = rows.optJSONObject(i);
                if (item == null) {
                    continue;
                }
                result.add(new String[]{
                        dash(item.optString("key", "-")),
                        numberText(item, "records", "0"),
                        percentValue(item.opt("averageGrossAbsPct")),
                        dash(item.optString("marketIndicator", "-")),
                        item.optBoolean("marketWarning", false) ? "Revisar lote" : "Sem alerta"
                });
            }
        }
        if (result.isEmpty()) {
            result.add(new String[]{"-", "-", "-", "-", "Nenhum dado disponível."});
        }
        return result;
    }

    private List<String[]> initialRows(JSONArray rows) {
        List<String[]> result = new ArrayList<>();
        if (rows != null) {
            for (int i = 0; i < rows.length(); i += 1) {
                JSONObject item = rows.optJSONObject(i);
                if (item == null) {
                    continue;
                }
                result.add(new String[]{
                        String.valueOf(i + 1),
                        shortId(item.optString("id", "-")),
                        firstNonEmpty(item.optString("species", ""), item.optString("productBrand", ""), "-")
                                + " / " + firstNonEmpty(item.optString("productBrand", ""), item.optString("species", ""), "-"),
                        dash(item.optString("lote", "-")),
                        dash(item.optString("plantName", "-")),
                        dash(item.optString("monitor", "-")),
                        gramValue(item.opt("gross")),
                        gramValue(item.opt("net")),
                        minuteValue(item.opt("timeMin")),
                        dash(item.optString("status", "-"))
                });
            }
        }
        if (result.isEmpty()) {
            result.add(new String[]{"-", "-", "-", "-", "-", "-", "-", "-", "-", "Nenhum dado disponível."});
        }
        return result;
    }

    private List<String[]> finalizedRows(JSONArray rows) {
        List<String[]> result = new ArrayList<>();
        if (rows != null) {
            for (int i = 0; i < rows.length(); i += 1) {
                JSONObject item = rows.optJSONObject(i);
                if (item == null) {
                    continue;
                }
                result.add(new String[]{
                        String.valueOf(i + 1),
                        shortId(item.optString("id", "-")),
                        dash(item.optString("lote", "-")),
                        firstNonEmpty(item.optString("productBrand", ""), item.optString("species", ""), "-"),
                        dash(item.optString("monitor", "-")),
                        gramValue(item.opt("gross")),
                        gramValue(item.opt("finalGross")),
                        gramValue(item.opt("finalNet")),
                        percentValue(item.opt("grossAbsPct")),
                        dash(item.optString("marketIndicator", "-"))
                });
            }
        }
        if (result.isEmpty()) {
            result.add(new String[]{"-", "-", "-", "-", "-", "-", "-", "-", "-", "Nenhum dado disponível."});
        }
        return result;
    }

    private List<String[]> absorptionRows(JSONArray rows) {
        List<String[]> result = new ArrayList<>();
        if (rows != null) {
            for (int i = 0; i < rows.length(); i += 1) {
                JSONObject item = rows.optJSONObject(i);
                if (item == null) {
                    continue;
                }
                result.add(new String[]{
                        String.valueOf(i + 1),
                        shortId(item.optString("id", "-")),
                        firstNonEmpty(item.optString("species", ""), item.optString("productBrand", ""), "-")
                                + " / " + firstNonEmpty(item.optString("productBrand", ""), item.optString("species", ""), "-"),
                        dash(item.optString("lote", "-")),
                        dash(item.optString("baseType", "-")),
                        gramValue(item.opt("initialWeight")),
                        gramValue(item.opt("finalWeight")),
                        gramValue(item.opt("dryWeight")),
                        gramValue(item.opt("absorption")),
                        percentValue(item.opt("absorptionPercent")),
                        dash(item.optString("note", "-"))
                });
            }
        }
        if (result.isEmpty()) {
            result.add(new String[]{"-", "-", "-", "-", "-", "-", "-", "-", "-", "-", "Nenhum dado disponível."});
        }
        return result;
    }

    private String buildConclusion(JSONObject report, JSONObject totals) {
        String explicit = report.optString("conclusion", "").trim();
        if (!explicit.isEmpty()) {
            return explicit;
        }
        int initial = totals == null ? 0 : totals.optInt("initialRecords", 0);
        int finalized = totals == null ? 0 : totals.optInt("finalizedRecords", 0);
        int pending = totals == null ? 0 : totals.optInt("pendingRecords", 0);
        if (initial == 0) {
            return "Sem registros de pesagem para emissão de conclusão técnica.";
        }
        if (finalized == 0) {
            return "Laudo parcial: há pesagens iniciais registradas, mas ainda não existem pesagens finais para conclusão de perda/absorção.";
        }
        if (pending > 0) {
            return "Laudo parcial: existem pesagens finais registradas, mas ainda há amostras pendentes de finalização.";
        }
        return "Laudo concluído: todas as amostras registradas possuem pesagem final e indicadores consolidados de perda/absorção.";
    }

    private String userString(JSONObject user, String key) {
        return user == null ? "" : user.optString(key, "");
    }

    private String jsonString(JSONObject json, String key) {
        return json == null ? "" : json.optString(key, "");
    }

    private String joinJsonArray(JSONObject json, String key) {
        if (json == null) {
            return "";
        }
        JSONArray array = json.optJSONArray(key);
        if (array == null || array.length() == 0) {
            return "";
        }
        List<String> values = new ArrayList<>();
        for (int i = 0; i < array.length(); i += 1) {
            String value = array.optString(i, "").trim();
            if (!value.isEmpty()) {
                values.add(value);
            }
        }
        if (values.isEmpty()) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        for (int i = 0; i < values.size(); i += 1) {
            if (i > 0) {
                builder.append(", ");
            }
            builder.append(values.get(i));
        }
        return builder.toString();
    }

    private String firstNonEmpty(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.trim().isEmpty() && !"-".equals(value.trim())) {
                return value.trim();
            }
        }
        return "";
    }

    private String stringOr(String value, String fallback) {
        String text = value == null ? "" : value.trim();
        return text.isEmpty() ? fallback : text;
    }

    private String dash(String value) {
        String text = value == null ? "" : value.trim();
        return text.isEmpty() ? "-" : text;
    }

    private String numberText(JSONObject json, String key, String fallback) {
        if (json == null || !json.has(key) || json.isNull(key)) {
            return fallback;
        }
        Object value = json.opt(key);
        if (value instanceof Number) {
            double number = ((Number) value).doubleValue();
            if (Math.rint(number) == number) {
                return String.valueOf((long) number);
            }
            return formatDecimal(number, 2);
        }
        return dash(String.valueOf(value));
    }

    private String gramText(JSONObject json, String key) {
        if (json == null || !json.has(key) || json.isNull(key)) {
            return "-";
        }
        return gramValue(json.opt(key));
    }

    private String minuteText(JSONObject json, String key) {
        if (json == null || !json.has(key) || json.isNull(key)) {
            return "-";
        }
        return minuteValue(json.opt(key));
    }

    private String percentText(JSONObject json, String key) {
        if (json == null || !json.has(key) || json.isNull(key)) {
            return "-";
        }
        return percentValue(json.opt(key));
    }

    private String gramValue(Object value) {
        Double number = asDouble(value);
        return number == null ? "-" : formatDecimal(number, 2) + " g";
    }

    private String minuteValue(Object value) {
        Double number = asDouble(value);
        return number == null ? "-" : formatDecimal(number, 2) + " min";
    }

    private String percentValue(Object value) {
        Double number = asDouble(value);
        return number == null ? "-" : formatDecimal(number, 6) + " %";
    }

    private Double asDouble(Object value) {
        if (value == null || JSONObject.NULL.equals(value)) {
            return null;
        }
        if (value instanceof Number) {
            return ((Number) value).doubleValue();
        }
        try {
            String text = String.valueOf(value).trim().replace(",", ".");
            if (text.isEmpty()) {
                return null;
            }
            return Double.parseDouble(text);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }

    private String formatDecimal(double value, int maxDecimals) {
        if (!Double.isFinite(value)) {
            return "-";
        }
        String format = "%." + maxDecimals + "f";
        String text = String.format(Locale.US, format, value)
                .replaceAll("0+$", "")
                .replaceAll("\\.$", "");
        return text.replace(".", ",");
    }

    private String formatDateValue(Object value) {
        if (value == null || JSONObject.NULL.equals(value)) {
            return "";
        }
        try {
            if (value instanceof Number) {
                long millis = ((Number) value).longValue();
                if (millis <= 0L) {
                    return "";
                }
                return new SimpleDateFormat("dd/MM/yyyy HH:mm", new Locale("pt", "BR")).format(new Date(millis));
            }
            String text = String.valueOf(value).trim();
            if (text.isEmpty()) {
                return "";
            }
            try {
                long millis = Long.parseLong(text);
                return new SimpleDateFormat("dd/MM/yyyy HH:mm", new Locale("pt", "BR")).format(new Date(millis));
            } catch (NumberFormatException ignored) {
            }
            return text;
        } catch (Exception ignored) {
            return "";
        }
    }

    private String shortId(String value) {
        String text = dash(value);
        if (text.length() <= 12) {
            return text;
        }
        return text.substring(0, 12);
    }

    private final class NativeReportPdfWriter {
        private static final int PAGE_WIDTH = 595;
        private static final int PAGE_HEIGHT = 842;
        private static final int MARGIN_LEFT = 36;
        private static final int MARGIN_RIGHT = 36;
        private static final int MARGIN_TOP = 34;
        private static final int MARGIN_BOTTOM = 46;

        private final PdfDocument document = new PdfDocument();
        private final String footer;
        private PdfDocument.Page page;
        private Canvas canvas;
        private int pageNumber = 0;
        private float y;
        private final Paint titlePaint = paint(18f, true, Color.rgb(15, 23, 42));
        private final Paint subtitlePaint = paint(8.8f, false, Color.rgb(71, 85, 105));
        private final Paint sectionPaint = paint(11.5f, true, Color.rgb(15, 23, 42));
        private final Paint labelPaint = paint(7.8f, true, Color.rgb(51, 65, 85));
        private final Paint bodyPaint = paint(8.2f, false, Color.rgb(15, 23, 42));
        private final Paint smallPaint = paint(6.8f, false, Color.rgb(15, 23, 42));
        private final Paint linePaint = paint(1f, false, Color.rgb(203, 213, 225));

        NativeReportPdfWriter(String footer) {
            this.footer = footer == null ? "" : footer;
            startPage();
        }

        private Paint paint(float textSize, boolean bold, int color) {
            Paint paint = new Paint(Paint.ANTI_ALIAS_FLAG);
            paint.setColor(color);
            paint.setTextSize(textSize);
            paint.setTypeface(bold ? Typeface.create(Typeface.DEFAULT, Typeface.BOLD) : Typeface.create(Typeface.DEFAULT, Typeface.NORMAL));
            return paint;
        }

        private int contentWidth() {
            return PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
        }

        private float bottom() {
            return PAGE_HEIGHT - MARGIN_BOTTOM;
        }

        private void startPage() {
            pageNumber += 1;
            PdfDocument.PageInfo pageInfo = new PdfDocument.PageInfo.Builder(PAGE_WIDTH, PAGE_HEIGHT, pageNumber).create();
            page = document.startPage(pageInfo);
            canvas = page.getCanvas();
            canvas.drawColor(Color.WHITE);
            y = MARGIN_TOP;
            if (pageNumber > 1) {
                canvas.drawText("DripTest - Laudo técnico de análise de gotejamento", MARGIN_LEFT, 24, subtitlePaint);
                y = 42;
            }
        }

        private void finishPage() {
            if (page == null) {
                return;
            }
            Paint footerPaint = paint(7f, false, Color.rgb(71, 85, 105));
            canvas.drawLine(MARGIN_LEFT, PAGE_HEIGHT - 32, PAGE_WIDTH - MARGIN_RIGHT, PAGE_HEIGHT - 32, linePaint);
            canvas.drawText(footer, MARGIN_LEFT, PAGE_HEIGHT - 20, footerPaint);
            canvas.drawText("Página " + pageNumber, PAGE_WIDTH - MARGIN_RIGHT - 42, PAGE_HEIGHT - 20, footerPaint);
            document.finishPage(page);
            page = null;
            canvas = null;
        }

        private void ensure(float height) {
            if (y + height <= bottom()) {
                return;
            }
            finishPage();
            startPage();
        }

        void writeTo(File file) throws IOException {
            finishPage();
            FileOutputStream outputStream = new FileOutputStream(file, false);
            document.writeTo(outputStream);
            outputStream.flush();
            outputStream.close();
            document.close();
        }

        void title(String title, String subtitle) {
            ensure(70);
            canvas.drawText(title, MARGIN_LEFT, y + 18, titlePaint);
            y += 32;
            canvas.drawText(subtitle, MARGIN_LEFT, y, subtitlePaint);
            y += 12;
            canvas.drawLine(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y, linePaint);
            y += 14;
        }

        void sectionTitle(String text) {
            ensure(28);
            y += 6;
            canvas.drawText(text, MARGIN_LEFT, y + 10, sectionPaint);
            y += 17;
            canvas.drawLine(MARGIN_LEFT, y, PAGE_WIDTH - MARGIN_RIGHT, y, linePaint);
            y += 8;
        }

        void keyValueGrid(String[][] pairs) {
            float colW = (contentWidth() - 12) / 2f;
            for (int i = 0; i < pairs.length; i += 2) {
                String[] left = pairs[i];
                String[] right = i + 1 < pairs.length ? pairs[i + 1] : new String[]{"", ""};
                float rowH = Math.max(
                        keyValueHeight(left, colW),
                        keyValueHeight(right, colW)
                );
                ensure(rowH + 6);
                drawKeyValue(left[0], left[1], MARGIN_LEFT, y, colW, rowH);
                if (right[0] != null && !right[0].isEmpty()) {
                    drawKeyValue(right[0], right[1], MARGIN_LEFT + colW + 12, y, colW, rowH);
                }
                y += rowH + 6;
            }
        }

        private float keyValueHeight(String[] pair, float width) {
            if (pair == null || pair.length < 2) {
                return 22;
            }
            List<String> lines = wrap(pair[1], bodyPaint, width - 12);
            return Math.max(26, 15 + lines.size() * 9f);
        }

        private void drawKeyValue(String label, String value, float x, float top, float width, float height) {
            drawRect(x, top, width, height, Color.rgb(248, 250, 252), Color.rgb(226, 232, 240));
            canvas.drawText(dash(label).toUpperCase(Locale.ROOT), x + 6, top + 10, labelPaint);
            drawWrapped(dash(value), bodyPaint, x + 6, top + 21, width - 12, 9f);
        }

        void twoColumnBoxes(String left, String right) {
            float gap = 12;
            float colW = (contentWidth() - gap) / 2f;
            float leftH = boxHeight(left, colW);
            float rightH = boxHeight(right, colW);
            float height = Math.max(leftH, rightH);
            ensure(height + 4);
            drawTextBox(left, MARGIN_LEFT, y, colW, height);
            drawTextBox(right, MARGIN_LEFT + colW + gap, y, colW, height);
            y += height + 4;
        }

        private float boxHeight(String text, float width) {
            List<String> lines = wrap(text, bodyPaint, width - 16);
            return Math.max(54, 16 + lines.size() * 9f);
        }

        private void drawTextBox(String text, float x, float top, float width, float height) {
            drawRect(x, top, width, height, Color.rgb(251, 253, 255), Color.rgb(203, 213, 225));
            drawWrapped(text, bodyPaint, x + 8, top + 13, width - 16, 9f);
        }

        void cards(String[][] cards) {
            float gap = 8;
            float cardW = (contentWidth() - gap * 3) / 4f;
            float height = 46;
            ensure(height + 8);
            for (int i = 0; i < cards.length; i += 1) {
                float x = MARGIN_LEFT + i * (cardW + gap);
                drawRect(x, y, cardW, height, Color.rgb(241, 245, 249), Color.rgb(203, 213, 225));
                canvas.drawText(cards[i][0].toUpperCase(Locale.ROOT), x + 7, y + 13, labelPaint);
                Paint valuePaint = paint(13f, true, Color.rgb(15, 23, 42));
                drawWrapped(cards[i][1], valuePaint, x + 7, y + 31, cardW - 14, 13f);
            }
            y += height + 8;
        }

        void bullets(String[] items) {
            float startX = MARGIN_LEFT + 8;
            for (String item : items) {
                List<String> lines = wrap(item, bodyPaint, contentWidth() - 22);
                ensure(lines.size() * 9f + 4);
                canvas.drawCircle(MARGIN_LEFT + 2, y + 4, 1.6f, bodyPaint);
                drawWrapped(item, bodyPaint, startX, y + 7, contentWidth() - 22, 9f);
                y += lines.size() * 9f + 3;
            }
            y += 4;
        }

        void callout(String text) {
            float height = Math.max(36, 16 + wrap(text, bodyPaint, contentWidth() - 20).size() * 9f);
            ensure(height + 4);
            drawRect(MARGIN_LEFT, y, contentWidth(), height, Color.rgb(249, 250, 251), Color.rgb(15, 23, 42));
            drawWrapped(text, bodyPaint, MARGIN_LEFT + 10, y + 15, contentWidth() - 20, 9f);
            y += height + 4;
        }

        void table(String[] headers, List<String[]> rows, float[] weights, float fontSize) {
            Paint headerPaint = paint(fontSize, true, Color.rgb(15, 23, 42));
            Paint cellPaint = paint(fontSize, false, Color.rgb(15, 23, 42));
            float[] widths = widths(weights);
            drawTableRow(headers, widths, headerPaint, true);
            for (String[] row : rows) {
                drawTableRow(row, widths, cellPaint, false);
            }
            y += 4;
        }

        private float[] widths(float[] weights) {
            float total = 0;
            for (float weight : weights) {
                total += weight;
            }
            float[] widths = new float[weights.length];
            for (int i = 0; i < weights.length; i += 1) {
                widths[i] = contentWidth() * weights[i] / total;
            }
            return widths;
        }

        private void drawTableRow(String[] cells, float[] widths, Paint paint, boolean header) {
            float rowH = 18;
            for (int i = 0; i < widths.length; i += 1) {
                String cell = i < cells.length ? dash(cells[i]) : "";
                rowH = Math.max(rowH, 8 + wrap(cell, paint, widths[i] - 6).size() * (paint.getTextSize() + 1.6f));
            }
            ensure(rowH);
            float x = MARGIN_LEFT;
            for (int i = 0; i < widths.length; i += 1) {
                String cell = i < cells.length ? dash(cells[i]) : "";
                drawRect(x, y, widths[i], rowH, header ? Color.rgb(226, 232, 240) : Color.WHITE, Color.rgb(203, 213, 225));
                drawWrapped(cell, paint, x + 3, y + paint.getTextSize() + 4, widths[i] - 6, paint.getTextSize() + 1.6f);
                x += widths[i];
            }
            y += rowH;
        }

        private void drawRect(float x, float top, float width, float height, int fill, int stroke) {
            Paint fillPaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            fillPaint.setStyle(Paint.Style.FILL);
            fillPaint.setColor(fill);
            canvas.drawRect(new RectF(x, top, x + width, top + height), fillPaint);
            Paint strokePaint = new Paint(Paint.ANTI_ALIAS_FLAG);
            strokePaint.setStyle(Paint.Style.STROKE);
            strokePaint.setStrokeWidth(0.7f);
            strokePaint.setColor(stroke);
            canvas.drawRect(new RectF(x, top, x + width, top + height), strokePaint);
        }

        private void drawWrapped(String text, Paint paint, float x, float baseline, float maxWidth, float lineHeight) {
            List<String> lines = wrap(text, paint, maxWidth);
            float currentY = baseline;
            for (String line : lines) {
                canvas.drawText(line, x, currentY, paint);
                currentY += lineHeight;
            }
        }

        private List<String> wrap(String text, Paint paint, float maxWidth) {
            List<String> lines = new ArrayList<>();
            String source = dash(text).replace("\r", "");
            String[] paragraphs = source.split("\n", -1);
            for (String paragraph : paragraphs) {
                String trimmed = paragraph.trim();
                if (trimmed.isEmpty()) {
                    lines.add("");
                    continue;
                }
                String[] words = trimmed.split("\\s+");
                StringBuilder line = new StringBuilder();
                for (String word : words) {
                    String candidate = line.length() == 0 ? word : line + " " + word;
                    if (paint.measureText(candidate) <= maxWidth) {
                        line = new StringBuilder(candidate);
                    } else {
                        if (line.length() > 0) {
                            lines.add(line.toString());
                            line = new StringBuilder();
                        }
                        if (paint.measureText(word) > maxWidth) {
                            StringBuilder chunk = new StringBuilder();
                            for (int index = 0; index < word.length(); index += 1) {
                                String next = chunk.toString() + word.charAt(index);
                                if (chunk.length() > 0 && paint.measureText(next) > maxWidth) {
                                    lines.add(chunk.toString());
                                    chunk = new StringBuilder(String.valueOf(word.charAt(index)));
                                } else {
                                    chunk = new StringBuilder(next);
                                }
                            }
                            line = chunk;
                        } else {
                            line = new StringBuilder(word);
                        }
                    }
                }
                if (line.length() > 0) {
                    lines.add(line.toString());
                }
            }
            return lines.isEmpty() ? new ArrayList<String>() {{ add("-"); }} : lines;
        }
    }

    private JSONObject buildErrorPayload(String requestId, String errorMessage) {
        JSONObject payload = new JSONObject();
        try {
            payload.put("requestId", requestId);
            payload.put("ok", false);
            payload.put("error", errorMessage == null ? "Falha desconhecida." : errorMessage);
        } catch (JSONException ignored) {
        }
        return payload;
    }

    private final class AndroidBridge {
        @JavascriptInterface
        public String scheduleReminder(String payload) {
            try {
                JSONObject json = new JSONObject(payload);
                String requestId = json.optString("requestId");
                String reminderId = json.optString("reminderId");
                long triggerAt = json.optLong("triggerAt");
                String title = json.optString("title", "Hora do gotejamento");
                String text = json.optString("text", "Confira o DripTest.");

                if (reminderId.isEmpty() || triggerAt <= 0L) {
                    return buildErrorPayload(requestId, "Dados invalidos para lembrete.").toString();
                }

                MainActivity.this.scheduleReminder(reminderId, triggerAt, title, text);

                JSONObject result = new JSONObject();
                result.put("requestId", requestId);
                result.put("ok", true);
                result.put("triggerAt", triggerAt);
                return result.toString();
            } catch (Exception error) {
                return buildErrorPayload("", error.getMessage()).toString();
            }
        }

        @JavascriptInterface
        public String cancelReminder(String payload) {
            try {
                JSONObject json = new JSONObject(payload);
                String requestId = json.optString("requestId");
                String reminderId = json.optString("reminderId");
                cancelReminder(reminderId);

                JSONObject result = new JSONObject();
                result.put("requestId", requestId);
                result.put("ok", true);
                return result.toString();
            } catch (Exception error) {
                return buildErrorPayload("", error.getMessage()).toString();
            }
        }

        @JavascriptInterface
        public String savePdfFromHtml(String payload) {
            try {
                final JSONObject json = new JSONObject(payload);
                final String requestId = json.optString("requestId");
                final String filename = json.optString("filename", "driptest-documento.pdf");
                final String html = json.optString("html", "");
                final String title = json.optString("title", "DripTest");
                final boolean share = json.optBoolean("share", false);
                final boolean open = json.optBoolean("open", false);
                final String text = json.optString("text", "");
                final boolean landscape = json.optBoolean("landscape", false);

                if (html.trim().isEmpty()) {
                    return buildErrorPayload(requestId, "HTML vazio para gerar PDF.").toString();
                }

                mainHandler.post(new Runnable() {
                    @Override
                    public void run() {
                        renderHtmlToPdf(requestId, filename, html, title, share, open, text, landscape);
                    }
                });

                JSONObject result = new JSONObject();
                result.put("requestId", requestId);
                result.put("ok", true);
                result.put("queued", true);
                return result.toString();
            } catch (Exception error) {
                return buildErrorPayload("", error.getMessage()).toString();
            }
        }

        @JavascriptInterface
        public String saveReportPdf(String payload) {
            try {
                final JSONObject json = new JSONObject(payload);
                final String requestId = json.optString("requestId");
                final String filename = json.optString("filename", "driptest-laudo.pdf");
                final JSONObject report = json.optJSONObject("report");
                final JSONObject user = json.optJSONObject("user");
                final String reportNumber = json.optString("reportNumber", "");
                final String hash = json.optString("hash", "");
                final String sourceLabel = json.optString("sourceLabel", "App Android DripTest");
                final String issuedAt = json.optString("issuedAt", "");
                final String title = json.optString("title", "Laudo DripTest");
                final boolean share = json.optBoolean("share", false);
                final boolean open = json.optBoolean("open", false);
                final String text = json.optString("text", "");

                if (report == null) {
                    return buildErrorPayload(requestId, "Dados do laudo ausentes.").toString();
                }

                mainHandler.post(new Runnable() {
                    @Override
                    public void run() {
                        writeNativeReportPdf(
                                requestId,
                                filename,
                                report,
                                user == null ? new JSONObject() : user,
                                reportNumber,
                                hash,
                                sourceLabel,
                                issuedAt,
                                title,
                                share,
                                open,
                                text
                        );
                    }
                });

                JSONObject result = new JSONObject();
                result.put("requestId", requestId);
                result.put("ok", true);
                result.put("queued", true);
                return result.toString();
            } catch (Exception error) {
                return buildErrorPayload("", error.getMessage()).toString();
            }
        }
    }
}

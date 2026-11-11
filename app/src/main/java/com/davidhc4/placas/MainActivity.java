package com.davidhc4.placas;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;

public class MainActivity extends Activity {

    private static final String REPO = "davidhc4/app-id";
    private static final String ARCHIVO = "placas.csv";
    private static final String MIME_APK = "application/vnd.android.package-archive";
    private static final int REQ_EXPORTAR = 1;
    private static final int REQ_IMPORTAR = 2;

    private WebView web;
    private String csvPorExportar;
    private long idDescarga = -1;
    private String urlDescarga;

    private final BroadcastReceiver alTerminarDescarga = new BroadcastReceiver() {
        @Override
        public void onReceive(Context c, Intent i) {
            long id = i.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
            if (id != idDescarga || id == -1) return;
            idDescarga = -1;
            abrirInstalador(id);
        }
    };

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#0e1116"));
        setContentView(web);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setTextZoom(100);
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new Puente(), "Android");
        web.loadUrl("file:///android_asset/index.html");

        IntentFilter filtro = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) registerReceiver(alTerminarDescarga, filtro, Context.RECEIVER_EXPORTED);
        else registerReceiver(alTerminarDescarga, filtro);
    }

    @Override
    protected void onDestroy() {
        try { unregisterReceiver(alTerminarDescarga); } catch (Exception e) { /* ya no estaba */ }
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        // La interfaz decide: cerrar el detalle, volver a "Anotar" o salir.
        web.evaluateJavascript("window.alAtras ? alAtras() : false", r -> {
            if (!"true".equals(r)) finish();
        });
    }

    /* ---------------- Archivo CSV ---------------- */

    private File archivoCsv() {
        File dir = getExternalFilesDir(null);
        if (dir == null) dir = getFilesDir();
        return new File(dir, ARCHIVO);
    }

    private static String leerTodo(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[8192];
        int n;
        while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        return new String(out.toByteArray(), StandardCharsets.UTF_8);
    }

    private void js(String codigo) {
        runOnUiThread(() -> web.evaluateJavascript(codigo, null));
    }

    @Override
    protected void onActivityResult(int req, int res, Intent datos) {
        super.onActivityResult(req, res, datos);
        Uri uri = (res == RESULT_OK && datos != null) ? datos.getData() : null;
        if (req == REQ_EXPORTAR) {
            String csv = csvPorExportar;
            csvPorExportar = null;
            if (uri == null || csv == null) return;
            boolean ok = true;
            try (OutputStream out = getContentResolver().openOutputStream(uri, "wt")) {
                out.write(csv.getBytes(StandardCharsets.UTF_8));
            } catch (Exception e) {
                ok = false;
            }
            js("alExportado(" + ok + ")");
        } else if (req == REQ_IMPORTAR) {
            if (uri == null) return;
            try (InputStream in = getContentResolver().openInputStream(uri)) {
                js("alImportar(" + JSONObject.quote(leerTodo(in)) + ")");
            } catch (Exception e) {
                js("alImportar(null)");
            }
        }
    }

    /* ---------------- Actualizaciones ---------------- */

    private int versionInstalada() {
        try {
            return (int) getPackageManager().getPackageInfo(getPackageName(), 0).getLongVersionCode();
        } catch (Exception e) {
            return 0;
        }
    }

    private String nombreVersion() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "";
        }
    }

    private void consultarUltimaVersion() {
        JSONObject r = new JSONObject();
        try {
            HttpURLConnection c = (HttpURLConnection) new URL("https://api.github.com/repos/" + REPO + "/releases/latest").openConnection();
            c.setRequestProperty("Accept", "application/vnd.github+json");
            c.setRequestProperty("User-Agent", "Placas");
            c.setConnectTimeout(10000);
            c.setReadTimeout(10000);
            if (c.getResponseCode() != 200) throw new Exception("HTTP " + c.getResponseCode());
            JSONObject rel;
            try (InputStream in = c.getInputStream()) { rel = new JSONObject(leerTodo(in)); }
            String tag = rel.getString("tag_name");
            int numero = Integer.parseInt(tag.substring(tag.lastIndexOf('.') + 1));
            String url = null;
            JSONArray archivos = rel.getJSONArray("assets");
            for (int i = 0; i < archivos.length(); i++) {
                JSONObject a = archivos.getJSONObject(i);
                if (a.getString("name").endsWith(".apk")) url = a.getString("browser_download_url");
            }
            boolean nueva = numero > versionInstalada() && url != null;
            r.put("estado", nueva ? "nueva" : "aldia");
            r.put("version", tag.startsWith("v") ? tag.substring(1) : tag);
            r.put("url", url);
        } catch (Exception e) {
            try { r.put("estado", "error"); } catch (Exception x) { /* imposible */ }
        }
        js("alActualizacion(" + r + ")");
    }

    private void descargarApk(String url) {
        urlDescarga = url;
        try {
            File destino = new File(getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "placas-actualizacion.apk");
            if (destino.exists()) destino.delete();
            DownloadManager.Request req = new DownloadManager.Request(Uri.parse(url))
                    .setTitle("Actualización de Placas")
                    .setMimeType(MIME_APK)
                    .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                    .setDestinationInExternalFilesDir(this, Environment.DIRECTORY_DOWNLOADS, "placas-actualizacion.apk");
            idDescarga = ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).enqueue(req);
        } catch (Exception e) {
            abrirEnNavegador(url);
        }
    }

    private void abrirInstalador(long id) {
        try {
            Uri apk = ((DownloadManager) getSystemService(DOWNLOAD_SERVICE)).getUriForDownloadedFile(id);
            if (apk == null) throw new Exception("descarga fallida");
            Intent i = new Intent(Intent.ACTION_VIEW)
                    .setDataAndType(apk, MIME_APK)
                    .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            startActivity(i);
            js("alDescarga(true)");
        } catch (Exception e) {
            // Plan B: el navegador descarga el APK y el sistema lo instala desde ahí.
            abrirEnNavegador(urlDescarga);
            js("alDescarga(false)");
        }
    }

    private void abrirEnNavegador(String url) {
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception e) { /* sin navegador */ }
    }

    /* ---------------- Puente con la interfaz ---------------- */

    private class Puente {

        @JavascriptInterface
        public String leer() {
            File f = archivoCsv();
            if (!f.exists()) return "";
            try (InputStream in = new FileInputStream(f)) {
                return leerTodo(in);
            } catch (Exception e) {
                return "";
            }
        }

        @JavascriptInterface
        public synchronized boolean guardar(String csv) {
            // Escribe en un temporal y luego reemplaza, para no dañar el archivo si algo falla.
            File f = archivoCsv();
            File tmp = new File(f.getParentFile(), ARCHIVO + ".tmp");
            try (FileOutputStream out = new FileOutputStream(tmp)) {
                out.write(csv.getBytes(StandardCharsets.UTF_8));
                out.getFD().sync();
            } catch (Exception e) {
                return false;
            }
            return tmp.renameTo(f);
        }

        @JavascriptInterface
        public String ruta() {
            return archivoCsv().getAbsolutePath();
        }

        @JavascriptInterface
        public void exportar(String nombre, String csv) {
            csvPorExportar = csv;
            Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("text/csv")
                    .putExtra(Intent.EXTRA_TITLE, nombre);
            runOnUiThread(() -> {
                try { startActivityForResult(i, REQ_EXPORTAR); } catch (Exception e) { js("alExportado(false)"); }
            });
        }

        @JavascriptInterface
        public void compartir(String csv) {
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, csv);
            runOnUiThread(() -> startActivity(Intent.createChooser(i, "Compartir placas")));
        }

        @JavascriptInterface
        public void importar() {
            Intent i = new Intent(Intent.ACTION_OPEN_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*");
            runOnUiThread(() -> {
                try { startActivityForResult(i, REQ_IMPORTAR); } catch (Exception e) { js("alImportar(null)"); }
            });
        }

        @JavascriptInterface
        public void tema(boolean oscuro) {
            runOnUiThread(() -> {
                int fondo = Color.parseColor(oscuro ? "#0e1116" : "#f4f5f7");
                getWindow().setStatusBarColor(fondo);
                getWindow().setNavigationBarColor(Color.parseColor(oscuro ? "#181c23" : "#ffffff"));
                web.setBackgroundColor(fondo);
                int claros = View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR | View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
                getWindow().getDecorView().setSystemUiVisibility(oscuro ? 0 : claros);
            });
        }

        @JavascriptInterface
        public String version() {
            return nombreVersion();
        }

        @JavascriptInterface
        public void buscarActualizacion() {
            new Thread(MainActivity.this::consultarUltimaVersion).start();
        }

        @JavascriptInterface
        public void instalarActualizacion(String url) {
            runOnUiThread(() -> descargarApk(url));
        }
    }
}

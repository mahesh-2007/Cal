package com.mycalai.app;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final long MAX_APK_BYTES = 150L * 1024 * 1024;
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void getCurrentVersion(PluginCall call) {
        try {
            PackageInfo info = getContext().getPackageManager().getPackageInfo(getContext().getPackageName(), 0);
            call.resolve(new JSObject()
                .put("versionName", info.versionName == null ? "" : info.versionName)
                .put("versionCode", Build.VERSION.SDK_INT >= 28 ? info.getLongVersionCode() : info.versionCode));
        } catch (Exception error) {
            call.reject("Could not read the installed app version", error);
        }
    }

    @PluginMethod
    public void installUpdate(PluginCall call) {
        String url = call.getString("url");
        if (!isReleaseAssetUrl(url)) {
            call.reject("The update URL is not a valid Cal GitHub release asset");
            return;
        }
        if (Build.VERSION.SDK_INT >= 26 && !getContext().getPackageManager().canRequestPackageInstalls()) {
            Intent settings = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES)
                .setData(Uri.parse("package:" + getContext().getPackageName()));
            getActivity().startActivity(settings);
            call.resolve(new JSObject().put("permissionRequired", true));
            return;
        }

        executor.execute(() -> downloadAndInstall(call, url));
    }

    private boolean isReleaseAssetUrl(String value) {
        if (value == null) return false;
        try {
            Uri uri = Uri.parse(value);
            return "https".equalsIgnoreCase(uri.getScheme())
                && "github.com".equalsIgnoreCase(uri.getHost())
                && uri.getPath() != null
                && uri.getPath().startsWith("/mahesh-2007/Cal/releases/download/");
        } catch (Exception error) {
            return false;
        }
    }

    private void downloadAndInstall(PluginCall call, String assetUrl) {
        File directory = new File(getContext().getCacheDir(), "updates");
        File temporary = new File(directory, "MyCalAI.apk.tmp");
        File apk = new File(directory, "MyCalAI.apk");
        HttpURLConnection connection = null;
        try {
            if (!directory.isDirectory() && !directory.mkdirs()) {
                throw new IOException("Could not prepare temporary update storage");
            }
            connection = (HttpURLConnection) new URL(assetUrl).openConnection();
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(30000);
            connection.setInstanceFollowRedirects(true);
            connection.setRequestProperty("Accept", "application/octet-stream");
            int status = connection.getResponseCode();
            URL finalUrl = connection.getURL();
            String finalHost = finalUrl.getHost().toLowerCase();
            if (status != HttpURLConnection.HTTP_OK
                || !"https".equalsIgnoreCase(finalUrl.getProtocol())
                || !(finalHost.equals("github.com") || finalHost.endsWith(".githubusercontent.com"))) {
                throw new IOException("GitHub did not return a valid APK download");
            }
            long length = connection.getContentLengthLong();
            if (length > MAX_APK_BYTES) throw new IOException("The APK is larger than the allowed download size");

            try (InputStream input = connection.getInputStream();
                 FileOutputStream output = new FileOutputStream(temporary)) {
                byte[] buffer = new byte[16384];
                long total = 0;
                int count;
                while ((count = input.read(buffer)) != -1) {
                    total += count;
                    if (total > MAX_APK_BYTES) throw new IOException("The APK is larger than the allowed download size");
                    output.write(buffer, 0, count);
                }
            }
            if (!hasZipSignature(temporary)) throw new IOException("The downloaded file is not a valid APK");
            if (apk.exists() && !apk.delete()) throw new IOException("Could not replace a previous update download");
            if (!temporary.renameTo(apk)) throw new IOException("Could not prepare the APK for installation");

            Uri apkUri = FileProvider.getUriForFile(
                getContext(), getContext().getPackageName() + ".fileprovider", apk);
            Intent installer = new Intent(Intent.ACTION_VIEW)
                .setDataAndType(apkUri, "application/vnd.android.package-archive")
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getActivity().runOnUiThread(() -> {
                try {
                    getActivity().startActivity(installer);
                    call.resolve(new JSObject().put("permissionRequired", false));
                } catch (Exception error) {
                    call.reject("Android could not open the package installer", error);
                }
            });
        } catch (Exception error) {
            temporary.delete();
            call.reject("Could not download the app update: " +
                (error.getMessage() == null ? "unknown error" : error.getMessage()), error);
        } finally {
            if (connection != null) connection.disconnect();
        }
    }

    private boolean hasZipSignature(File file) throws IOException {
        try (InputStream input = new FileInputStream(file)) {
            return input.read() == 'P' && input.read() == 'K';
        }
    }

    @Override
    protected void handleOnDestroy() {
        executor.shutdown();
        super.handleOnDestroy();
    }
}

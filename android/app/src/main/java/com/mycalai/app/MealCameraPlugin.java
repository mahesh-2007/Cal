package com.mycalai.app;

import android.app.Activity;
import android.content.ClipData;
import android.content.Intent;
import android.content.ActivityNotFoundException;
import android.net.Uri;
import android.provider.MediaStore;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.IOException;
import java.io.InputStream;
import android.util.Base64;

@CapacitorPlugin(name = "MealCamera")
public class MealCameraPlugin extends Plugin {
    private static final int MAX_IMAGE_BYTES = 20 * 1024 * 1024;
    private File photoFile;

    @PluginMethod
    public void capture(PluginCall call) {
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        File directory = new File(getContext().getCacheDir(), "camera");
        if (!directory.isDirectory() && !directory.mkdirs()) {
            call.reject("Could not prepare temporary camera storage");
            return;
        }
        photoFile = new File(directory, "meal-capture.jpg");
        if (photoFile.exists() && !photoFile.delete()) {
            call.reject("Could not prepare a new camera photo");
            return;
        }

        Uri uri = FileProvider.getUriForFile(
            getContext(), getContext().getPackageName() + ".fileprovider", photoFile);
        intent.putExtra(MediaStore.EXTRA_OUTPUT, uri);
        intent.setClipData(ClipData.newRawUri("Meal photo", uri));
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try {
            startActivityForResult(call, intent, "captureResult");
        } catch (ActivityNotFoundException error) {
            deletePhoto();
            call.reject("No camera app is available on this device", error);
        }
    }

    @ActivityCallback
    private void captureResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            deletePhoto();
            call.resolve(new JSObject().put("cancelled", true));
            return;
        }
        if (photoFile == null || !photoFile.isFile() || photoFile.length() == 0) {
            deletePhoto();
            call.reject("The camera did not save a photo");
            return;
        }
        if (photoFile.length() > MAX_IMAGE_BYTES) {
            deletePhoto();
            call.reject("The camera photo is too large to process");
            return;
        }

        try (InputStream input = new FileInputStream(photoFile);
             ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int count;
            while ((count = input.read(buffer)) != -1) {
                if (output.size() + count > MAX_IMAGE_BYTES) {
                    deletePhoto();
                    call.reject("The camera photo is too large to process");
                    return;
                }
                output.write(buffer, 0, count);
            }
            call.resolve(new JSObject()
                .put("cancelled", false)
                .put("mimeType", "image/jpeg")
                .put("base64", Base64.encodeToString(output.toByteArray(), Base64.NO_WRAP)));
        } catch (IOException error) {
            call.reject("Could not read the camera photo", error);
        } finally {
            deletePhoto();
        }
    }

    private void deletePhoto() {
        if (photoFile != null) {
            photoFile.delete();
            photoFile = null;
        }
    }
}

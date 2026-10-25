package com.mycalai.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(BackupFilesPlugin.class);
        registerPlugin(StepAggregationPlugin.class);
        registerPlugin(AppUpdaterPlugin.class);
        registerPlugin(MealCameraPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

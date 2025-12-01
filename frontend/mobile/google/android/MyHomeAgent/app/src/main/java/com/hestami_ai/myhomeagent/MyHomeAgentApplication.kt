package com.hestami_ai.myhomeagent

import android.app.Application
import com.hestami_ai.myhomeagent.data.network.NetworkModule
import timber.log.Timber

class MyHomeAgentApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        
        // Initialize Timber for logging
        if (BuildConfig.DEBUG) {
            Timber.plant(Timber.DebugTree())
        }
        
        // Initialize network module with application context
        NetworkModule.initialize(this)
        
        Timber.d("MyHomeAgentApplication initialized")
    }
}
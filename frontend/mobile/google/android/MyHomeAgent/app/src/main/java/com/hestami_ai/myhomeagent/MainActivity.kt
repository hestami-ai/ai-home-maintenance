package com.hestami_ai.myhomeagent

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.Composable
import androidx.compose.ui.tooling.preview.Preview
import androidx.navigation.compose.rememberNavController
import com.hestami_ai.myhomeagent.navigation.AppNavGraph
import com.hestami_ai.myhomeagent.ui.theme.MyHomeAgentTheme
import timber.log.Timber

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        Timber.d("MainActivity created")
        enableEdgeToEdge()
        setContent {
            MyHomeAgentTheme {
                MyHomeAgentApp()
            }
        }
    }
}

@Composable
fun MyHomeAgentApp() {
    val navController = rememberNavController()
    AppNavGraph(navController = navController)
}

@Preview(showBackground = true)
@Composable
fun AppPreview() {
    MyHomeAgentTheme {
        MyHomeAgentApp()
    }
}
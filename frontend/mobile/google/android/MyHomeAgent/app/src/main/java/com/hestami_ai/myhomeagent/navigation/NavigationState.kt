package com.hestami_ai.myhomeagent.navigation

import com.hestami_ai.myhomeagent.data.model.Media
import com.hestami_ai.myhomeagent.data.model.Property
import com.hestami_ai.myhomeagent.data.model.ServiceRequest

/**
 * Holds navigation state for passing complex objects between screens.
 * This is a simple solution for passing non-serializable objects through navigation.
 */
object NavigationState {
    var selectedProperty: Property? = null
    var selectedServiceRequest: ServiceRequest? = null
    var selectedMedia: Media? = null
    
    fun clearProperty() {
        selectedProperty = null
    }
    
    fun clearServiceRequest() {
        selectedServiceRequest = null
    }
    
    fun clearMedia() {
        selectedMedia = null
    }
    
    fun clearAll() {
        selectedProperty = null
        selectedServiceRequest = null
        selectedMedia = null
    }
}

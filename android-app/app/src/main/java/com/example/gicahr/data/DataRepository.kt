package com.example.gicahr.data

import com.example.gicahr.data.api.GicaApiService
import com.example.gicahr.data.api.NetworkClient
import com.example.gicahr.data.model.*

class DataRepository(private val sessionManager: SessionManager) {

    private fun getService(): GicaApiService {
        return NetworkClient.getService(sessionManager.getServerUrl())
    }

    suspend fun login(matricule: String, password: String): User {
        return getService().login(LoginRequest(matricule, password))
    }

    suspend fun getPointages(matricule: String? = null): List<Pointage> {
        return getService().getPointages(matricule = matricule)
    }

    suspend fun getRecuperations(matricule: String? = null): List<Recuperation> {
        return getService().getRecuperations(matricule = matricule)
    }

    suspend fun saveRecuperation(recuperation: Recuperation): ApiResponse {
        return getService().saveRecuperation(recuperation)
    }

    suspend fun getAbsences(matricule: String? = null): List<Absence> {
        return getService().getAbsences(matricule = matricule)
    }

    suspend fun saveAbsence(absence: Absence): ApiResponse {
        return getService().saveAbsence(absence)
    }

    suspend fun getEmployees(): List<User> {
        return getService().getEmployees()
    }

    suspend fun getSettings(): kotlinx.serialization.json.JsonObject {
        return getService().getSettings()
    }

    suspend fun saveSettings(settings: kotlinx.serialization.json.JsonObject): ApiResponse {
        return getService().saveSettings(settings)
    }

    suspend fun testZkteco(ip: String, port: Int): ApiResponse {
        return getService().testZkteco(ZktecoTestRequest(ip, port))
    }

    suspend fun syncZkteco(): ApiResponse {
        return getService().syncZkteco()
    }
}

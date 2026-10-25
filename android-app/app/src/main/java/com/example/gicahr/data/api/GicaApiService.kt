package com.example.gicahr.data.api

import com.example.gicahr.data.model.*
import retrofit2.http.*

interface GicaApiService {
    @POST("login")
    suspend fun login(@Body request: LoginRequest): User

    @GET("employees")
    suspend fun getEmployees(): List<User>

    @GET("employees/{matricule}")
    suspend fun getEmployee(@Path("matricule") matricule: String): User

    @GET("pointages")
    suspend fun getPointages(
        @Query("date") date: String? = null,
        @Query("matricule") matricule: String? = null
    ): List<Pointage>

    @POST("pointages")
    suspend fun savePointages(@Body pointages: List<Pointage>): ApiResponse

    @GET("recuperations")
    suspend fun getRecuperations(
        @Query("matricule") matricule: String? = null
    ): List<Recuperation>

    @POST("recuperations")
    suspend fun saveRecuperation(@Body request: Recuperation): ApiResponse

    @GET("absences")
    suspend fun getAbsences(
        @Query("matricule") matricule: String? = null
    ): List<Absence>

    @POST("absences")
    suspend fun saveAbsence(@Body request: Absence): ApiResponse

    @GET("settings")
    suspend fun getSettings(): kotlinx.serialization.json.JsonObject

    @POST("settings")
    suspend fun saveSettings(@Body settings: kotlinx.serialization.json.JsonObject): ApiResponse

    @POST("settings/zkteco/test")
    suspend fun testZkteco(@Body request: ZktecoTestRequest): ApiResponse

    @POST("settings/zkteco/sync")
    suspend fun syncZkteco(): ApiResponse
}

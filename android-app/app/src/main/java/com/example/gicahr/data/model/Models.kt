package com.example.gicahr.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class User(
    val matricule: String,
    val nom: String,
    val prenom: String,
    val departement: String,
    val poste: String,
    val role: String, // employee, supervisor, hr
    @SerialName("solde_recuperation") val soldeRecuperation: Double = 0.0,
    @SerialName("solde_conge") val soldeConge: Double = 0.0,
    @SerialName("horaire_debut") val horaireDebut: String? = null,
    @SerialName("horaire_fin") val horaireFin: String? = null,
    @SerialName("date_embauche") val dateEmbauche: String? = null,
    val actif: Int? = 1
)

@Serializable
data class Pointage(
    val id: String,
    val matricule: String,
    val date: String,
    @SerialName("heure_entree") val heureEntree: String? = null,
    @SerialName("heure_sortie") val heureSortie: String? = null,
    val retard: Double = 0.0,
    @SerialName("heures_supp") val heuresSupp: Double = 0.0,
    @SerialName("heures_travaillees") val heuresTravaillees: Double = 0.0,
    val anomalie: Int = 0,
    val notes: String? = null,
    @SerialName("shift_type") val shiftType: String? = null
)

@Serializable
data class Recuperation(
    val id: String? = null,
    val matricule: String,
    @SerialName("date_demande") val dateDemande: String? = null,
    @SerialName("date_debut") val dateDebut: String? = null,
    @SerialName("date_fin") val dateFin: String? = null,
    val duree: Double, // en heures
    val motif: String,
    val statut: String = "En attente", // En attente, Approuvé, Rejeté
    @SerialName("decide_par") val decidePar: String? = null,
    @SerialName("date_decision") val dateDecision: String? = null
)

@Serializable
data class Absence(
    val id: String? = null,
    val matricule: String,
    @SerialName("date_demande") val dateDemande: String? = null,
    @SerialName("date_debut") val dateDebut: String,
    @SerialName("date_fin") val dateFin: String,
    @SerialName("duree_jours") val dureeJours: Double,
    @SerialName("type_conge") val typeConge: String, // Annuel, Exceptionnel, Maladie, etc.
    val motif: String? = null,
    val statut: String = "En attente",
    @SerialName("decide_par") val decidePar: String? = null,
    @SerialName("date_decision") val dateDecision: String? = null
)

@Serializable
data class LoginRequest(
    val matricule: String,
    val password: String
)

@Serializable
data class ApiResponse(
    val success: Boolean,
    val id: String? = null,
    val message: String? = null,
    val error: String? = null
)

@Serializable
data class ZktecoTestRequest(
    val ip: String,
    val port: Int
)


package com.example.gicahr.ui.screens

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.gicahr.data.DataRepository
import com.example.gicahr.data.model.Absence
import com.example.gicahr.data.model.Recuperation
import com.example.gicahr.data.model.User
import com.example.gicahr.theme.*
import com.example.gicahr.utils.Localization
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.*

@Composable
fun RequestsScreen(
    user: User,
    repository: DataRepository,
    currentLanguage: String
) {
    var selectedTab by remember { mutableStateOf(0) }
    var absences by remember { mutableStateOf<List<Absence>>(emptyList()) }
    var recuperations by remember { mutableStateOf<List<Recuperation>>(emptyList()) }
    var isLoading by remember { mutableStateOf(true) }
    var showNewRequestDialog by remember { mutableStateOf(false) }

    val coroutineScope = rememberCoroutineScope()

    val refreshData = {
        coroutineScope.launch {
            isLoading = true
            try {
                absences = repository.getAbsences(user.matricule).sortedByDescending { it.dateDemande }
                recuperations = repository.getRecuperations(user.matricule).sortedByDescending { it.dateDemande }
            } catch (e: Exception) {
                e.printStackTrace()
            } finally {
                isLoading = false
            }
        }
    }

    LaunchedEffect(user.matricule) {
        refreshData()
    }

    Scaffold(
        floatingActionButton = {
            FloatingActionButton(
                onClick = { showNewRequestDialog = true },
                containerColor = MaterialTheme.colorScheme.primary,
                contentColor = Color.White
            ) {
                Icon(imageVector = Icons.Default.Add, contentDescription = "Add Request")
            }
        }
    ) { paddingValues ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(paddingValues)
        ) {
            // Tab Header
            TabRow(selectedTabIndex = selectedTab) {
                Tab(
                    selected = selectedTab == 0,
                    onClick = { selectedTab = 0 },
                    text = { Text(Localization.getString("absences", currentLanguage), fontWeight = FontWeight.Bold) }
                )
                Tab(
                    selected = selectedTab == 1,
                    onClick = { selectedTab = 1 },
                    text = { Text(Localization.getString("recuperations", currentLanguage), fontWeight = FontWeight.Bold) }
                )
            }

            if (isLoading) {
                Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator()
                }
            } else {
                if (selectedTab == 0) {
                    AbsencesList(absences = absences, currentLanguage = currentLanguage)
                } else {
                    RecuperationsList(recuperations = recuperations, currentLanguage = currentLanguage)
                }
            }
        }
    }

    if (showNewRequestDialog) {
        NewRequestDialog(
            user = user,
            repository = repository,
            currentLanguage = currentLanguage,
            onDismiss = { showNewRequestDialog = false },
            onSuccess = {
                showNewRequestDialog = false
                refreshData()
            }
        )
    }
}

@Composable
fun AbsencesList(absences: List<Absence>, currentLanguage: String) {
    if (absences.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(text = Localization.getString("no_data", currentLanguage), color = TextMuted)
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(absences) { a ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = "${Localization.getString("type_conge", currentLanguage)}: ${a.typeConge}",
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            StatusBadge(status = a.statut, currentLanguage = currentLanguage)
                        }

                        Divider(color = MaterialTheme.colorScheme.background)

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(
                                text = "${Localization.getString("date_debut", currentLanguage)}: ${a.dateDebut}",
                                fontSize = 13.sp,
                                color = TextSecondary
                            )
                            Text(
                                text = "${Localization.getString("date_fin", currentLanguage)}: ${a.dateFin}",
                                fontSize = 13.sp,
                                color = TextSecondary
                            )
                        }

                        Text(
                            text = "${Localization.getString("duration_days", currentLanguage)}: ${a.dureeJours}",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = GicaTeal
                        )

                        a.motif?.let {
                            Text(
                                text = "${Localization.getString("motif", currentLanguage)}: $it",
                                fontSize = 13.sp,
                                color = TextMuted
                            )
                        }

                        if (a.statut != "En attente" && a.decidePar != null) {
                            Text(
                                text = "${if (currentLanguage == "ar") "مقرر من طرف" else "Décidé par"}: ${a.decidePar} (${a.dateDecision ?: ""})",
                                fontSize = 11.sp,
                                color = TextMuted,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun RecuperationsList(recuperations: List<Recuperation>, currentLanguage: String) {
    if (recuperations.isEmpty()) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Text(text = Localization.getString("no_data", currentLanguage), color = TextMuted)
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            items(recuperations) { r ->
                Card(
                    modifier = Modifier.fillMaxWidth(),
                    shape = RoundedCornerShape(8.dp),
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
                    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
                ) {
                    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        Row(
                            modifier = Modifier.fillMaxWidth(),
                            horizontalArrangement = Arrangement.SpaceBetween,
                            verticalAlignment = Alignment.CenterVertically
                        ) {
                            Text(
                                text = Localization.getString("recuperations", currentLanguage),
                                fontWeight = FontWeight.Bold,
                                color = TextPrimary
                            )
                            StatusBadge(status = r.statut, currentLanguage = currentLanguage)
                        }

                        Divider(color = MaterialTheme.colorScheme.background)

                        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                            Text(
                                text = "${Localization.getString("date_debut", currentLanguage)}: ${r.dateDebut ?: ""}",
                                fontSize = 13.sp,
                                color = TextSecondary
                            )
                            Text(
                                text = "${Localization.getString("date_fin", currentLanguage)}: ${r.dateFin ?: ""}",
                                fontSize = 13.sp,
                                color = TextSecondary
                            )
                        }

                        Text(
                            text = "${Localization.getString("duration_hours", currentLanguage)}: ${r.duree}h",
                            fontSize = 13.sp,
                            fontWeight = FontWeight.Bold,
                            color = GicaIndigo
                        )

                        Text(
                            text = "${Localization.getString("motif", currentLanguage)}: ${r.motif}",
                            fontSize = 13.sp,
                            color = TextMuted
                        )

                        if (r.statut != "En attente" && r.decidePar != null) {
                            Text(
                                text = "${if (currentLanguage == "ar") "مقرر من طرف" else "Décidé par"}: ${r.decidePar} (${r.dateDecision ?: ""})",
                                fontSize = 11.sp,
                                color = TextMuted,
                                fontWeight = FontWeight.Medium
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun StatusBadge(status: String, currentLanguage: String) {
    val displayStatus = when (status) {
        "En attente" -> if (currentLanguage == "ar") "معلق" else "En attente"
        "Approuvé" -> if (currentLanguage == "ar") "مقبول" else "Approuvé"
        else -> if (currentLanguage == "ar") "مرفوض" else "Refusé"
    }

    val badgeColor = when (status) {
        "En attente" -> WarningAmber
        "Approuvé" -> SuccessGreen
        else -> DangerRed
    }

    Box(
        modifier = Modifier
            .background(badgeColor.copy(alpha = 0.15f), RoundedCornerShape(4.dp))
            .padding(horizontal = 10.dp, vertical = 4.dp)
    ) {
        Text(
            text = displayStatus,
            color = badgeColor,
            fontSize = 11.sp,
            fontWeight = FontWeight.Bold
        )
    }
}

@Composable
fun NewRequestDialog(
    user: User,
    repository: DataRepository,
    currentLanguage: String,
    onDismiss: () -> Unit,
    onSuccess: () -> Unit
) {
    var typeIndex by remember { mutableStateOf(0) } // 0 = Congé, 1 = Récupération
    val types = listOf(
        Localization.getString("absences", currentLanguage),
        Localization.getString("recuperations", currentLanguage)
    )

    // Form states
    var dateDebut by remember { mutableStateOf("") }
    var dateFin by remember { mutableStateOf("") }
    var durationInput by remember { mutableStateOf("") }
    var motifInput by remember { mutableStateOf("") }
    var congeType by remember { mutableStateOf("Annuel") }

    val congeTypes = listOf("Annuel", "Exceptionnel", "Maladie", "Maternité")

    var isLoading by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    val coroutineScope = rememberCoroutineScope()

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Text(
                text = Localization.getString("btn_new_request", currentLanguage),
                fontWeight = FontWeight.Bold,
                fontSize = 18.sp
            )
        },
        text = {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Selector Type (Congé vs Récupération)
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    types.forEachIndexed { index, text ->
                        Button(
                            onClick = { typeIndex = index },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (typeIndex == index) MaterialTheme.colorScheme.primary else Color.LightGray.copy(alpha = 0.3f),
                                contentColor = if (typeIndex == index) Color.White else MaterialTheme.colorScheme.onBackground
                            ),
                            modifier = Modifier.weight(1f),
                            shape = RoundedCornerShape(8.dp)
                        ) {
                            Text(text = text, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                        }
                    }
                }

                // Date Début
                OutlinedTextField(
                    value = dateDebut,
                    onValueChange = { dateDebut = it },
                    label = { Text("${Localization.getString("date_debut", currentLanguage)} (YYYY-MM-DD)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                // Date Fin
                OutlinedTextField(
                    value = dateFin,
                    onValueChange = { dateFin = it },
                    label = { Text("${Localization.getString("date_fin", currentLanguage)} (YYYY-MM-DD)") },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth()
                )

                if (typeIndex == 0) {
                    // Congé fields
                    // Congé Type Select Dropdown placeholder (simplified as custom row)
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        congeTypes.take(2).forEach { type ->
                            Button(
                                onClick = { congeType = type },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (congeType == type) MaterialTheme.colorScheme.primary else Color.LightGray.copy(alpha = 0.2f),
                                    contentColor = if (congeType == type) Color.White else MaterialTheme.colorScheme.onBackground
                                ),
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(type, fontSize = 11.sp)
                            }
                        }
                    }
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(4.dp)
                    ) {
                        congeTypes.drop(2).forEach { type ->
                            Button(
                                onClick = { congeType = type },
                                colors = ButtonDefaults.buttonColors(
                                    containerColor = if (congeType == type) MaterialTheme.colorScheme.primary else Color.LightGray.copy(alpha = 0.2f),
                                    contentColor = if (congeType == type) Color.White else MaterialTheme.colorScheme.onBackground
                                ),
                                modifier = Modifier.weight(1f),
                                shape = RoundedCornerShape(6.dp)
                            ) {
                                Text(type, fontSize = 11.sp)
                            }
                        }
                    }

                    OutlinedTextField(
                        value = durationInput,
                        onValueChange = { durationInput = it },
                        label = { Text(Localization.getString("duration_days", currentLanguage)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                } else {
                    // Récupération duration
                    OutlinedTextField(
                        value = durationInput,
                        onValueChange = { durationInput = it },
                        label = { Text(Localization.getString("duration_hours", currentLanguage)) },
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Number),
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth()
                    )
                }

                // Motif
                OutlinedTextField(
                    value = motifInput,
                    onValueChange = { motifInput = it },
                    label = { Text(Localization.getString("motif", currentLanguage)) },
                    modifier = Modifier.fillMaxWidth()
                )

                errorMessage?.let { error ->
                    Text(
                        text = error,
                        color = MaterialTheme.colorScheme.error,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold
                    )
                }
            }
        },
        confirmButton = {
            Button(
                onClick = {
                    val durationVal = durationInput.toDoubleOrNull()
                    if (dateDebut.isBlank() || dateFin.isBlank() || durationVal == null || motifInput.isBlank()) {
                        errorMessage = Localization.getString("error_fields", currentLanguage)
                        return@Button
                    }
                    errorMessage = null
                    isLoading = true

                    coroutineScope.launch {
                        try {
                            if (typeIndex == 0) {
                                val absence = Absence(
                                    matricule = user.matricule,
                                    dateDebut = dateDebut,
                                    dateFin = dateFin,
                                    dureeJours = durationVal,
                                    typeConge = congeType,
                                    motif = motifInput
                                )
                                val res = repository.saveAbsence(absence)
                                if (res.success) onSuccess() else errorMessage = res.error
                            } else {
                                val recuperation = Recuperation(
                                    matricule = user.matricule,
                                    dateDebut = dateDebut,
                                    dateFin = dateFin,
                                    duree = durationVal,
                                    motif = motifInput
                                )
                                val res = repository.saveRecuperation(recuperation)
                                if (res.success) onSuccess() else errorMessage = res.error
                            }
                        } catch (e: Exception) {
                            e.printStackTrace()
                            errorMessage = Localization.getString("error_server", currentLanguage)
                        } finally {
                            isLoading = false
                        }
                    }
                },
                enabled = !isLoading
            ) {
                if (isLoading) {
                    CircularProgressIndicator(color = Color.White, modifier = Modifier.size(20.dp))
                } else {
                    Text(Localization.getString("btn_save", currentLanguage))
                }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) {
                Text(Localization.getString("btn_cancel", currentLanguage))
            }
        }
    )
}

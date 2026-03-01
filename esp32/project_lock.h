/*
 * VibeMon Project Lock
 * Project lock/unlock and lock mode management
 */

#ifndef PROJECT_LOCK_H
#define PROJECT_LOCK_H

// =============================================================================
// Project List Management
// =============================================================================

// Check if project exists in list
bool projectExists(const char* project) {
  for (int i = 0; i < projectCount; i++) {
    if (strcmp(projectList[i], project) == 0) {
      return true;
    }
  }
  return false;
}

// Add project to list (if not exists, max 10)
void addProjectToList(const char* project) {
  if (strlen(project) == 0) return;
  if (projectExists(project)) return;
  if (projectCount >= MAX_PROJECTS) {
    // Remove oldest project (shift array)
    for (int i = 0; i < MAX_PROJECTS - 1; i++) {
      safeCopyStr(projectList[i], projectList[i + 1]);
    }
    projectCount = MAX_PROJECTS - 1;
  }
  safeCopyStr(projectList[projectCount], project);
  projectCount++;
}

// =============================================================================
// Lock/Unlock Functions
// =============================================================================

// Lock to a specific project
void lockProject(const char* project) {
  if (strlen(project) > 0) {
    bool changed = (strcmp(lockedProject, project) != 0);
    addProjectToList(project);
    safeCopyStr(lockedProject, project);

    // Transition to idle state when lock changes
    if (changed) {
      previousState = currentState;
      currentState = STATE_IDLE;
      safeCopyStr(currentProject, project);
      currentTool[0] = '\0';
      currentModel[0] = '\0';
      currentMemory = 0;
      lastActivityTime = millis();
      needsRedraw = true;
      dirtyCharacter = true;
      dirtyStatus = true;
      dirtyInfo = true;
      drawStatus();
    }

    Serial.print("{\"locked\":\"");
    Serial.print(lockedProject);
    Serial.println("\",\"state\":\"idle\"}");
  }
}

// Unlock project
void unlockProject() {
  lockedProject[0] = '\0';
  Serial.println("{\"locked\":null}");
}

// =============================================================================
// Lock Mode Functions
// =============================================================================

// Set lock mode
void setLockMode(int mode) {
  if (mode == LOCK_MODE_FIRST_PROJECT || mode == LOCK_MODE_ON_THINKING) {
    lockMode = mode;
    lockedProject[0] = '\0';  // Reset lock when mode changes

    // Persist to flash storage
    preferences.begin("vibemon", false);  // Read-write mode
    preferences.putInt("lockMode", lockMode);
    preferences.end();

    Serial.print("{\"lockMode\":\"");
    Serial.print(mode == LOCK_MODE_FIRST_PROJECT ? "first-project" : "on-thinking");
    Serial.println("\",\"locked\":null}");
  }
}

// Get lock mode string
const char* getLockModeString() {
  return lockMode == LOCK_MODE_FIRST_PROJECT ? "first-project" : "on-thinking";
}

// Parse lock mode string
int parseLockMode(const char* modeStr) {
  if (strcmp(modeStr, "first-project") == 0) return LOCK_MODE_FIRST_PROJECT;
  if (strcmp(modeStr, "on-thinking") == 0) return LOCK_MODE_ON_THINKING;
  return -1;  // Invalid mode
}

// Check if locked to different project
bool isLockedToDifferentProject(const char* project) {
  if (strlen(lockedProject) == 0) return false;  // Not locked
  if (strlen(project) == 0) return false;  // No project specified
  return strcmp(lockedProject, project) != 0;
}

#endif // PROJECT_LOCK_H

import { create } from 'zustand';

export const usePlanStore = create((set, get) => ({
  // Step tracking
  currentStep: 0,

  // Step 1: Project inputs
  projectInputs: {
    projectName: '',
    description: '',
    rfpText: '',
    rfpFileName: '',
    startDate: '',
    deadline: '',
    industry: '',
    clientCountry: 'US',
    screenCount: 0,
    screenCountMethod: 'manual', // 'manual' | 'url' | 'app'
    screenCountUrl: '',
    screenCountConfirmed: false,
    rfpSignals: [],
  },

  // Step 2: Activity selection
  selectedActivities: [],
  sizing: 'M', // S | M | L
  aiSuggestions: [],
  aiReasonings: {},
  aiLoading: false,
  usabilityTestDep: 'E1', // E1 or E2

  // Step 3: Holiday confirmation
  confirmedHolidays: [],

  // Step 4: Schedule
  schedule: [],
  scheduleError: null,
  planRationale: null,
  manualOverrides: {},

  // Actions
  setCurrentStep: (step) => set({ currentStep: step }),

  updateProjectInputs: (updates) =>
    set((state) => ({
      projectInputs: { ...state.projectInputs, ...updates },
    })),

  setSelectedActivities: (activities) => set({ selectedActivities: activities }),

  toggleActivity: (activityId) =>
    set((state) => {
      const selected = state.selectedActivities;
      if (selected.includes(activityId)) {
        return { selectedActivities: selected.filter((id) => id !== activityId) };
      }
      return { selectedActivities: [...selected, activityId] };
    }),

  setSizing: (sizing) => set({ sizing }),

  setAiSuggestions: (suggestions) => set({ aiSuggestions: suggestions, aiLoading: false }),
  setAiReasonings: (reasonings) => set({ aiReasonings: reasonings }),
  setAiLoading: (loading) => set({ aiLoading: loading }),

  setUsabilityTestDep: (dep) => set({ usabilityTestDep: dep }),

  setConfirmedHolidays: (holidays) => set({ confirmedHolidays: holidays }),

  setSchedule: (schedule) => set({ schedule, scheduleError: null }),
  setScheduleError: (error) => set({ scheduleError: error }),
  setPlanRationale: (planRationale) => set({ planRationale }),

  setManualOverride: (id, date) =>
    set((state) => ({
      manualOverrides: { ...state.manualOverrides, [id]: { startDate: date } },
    })),
  clearManualOverride: (id) =>
    set((state) => {
      const next = { ...state.manualOverrides };
      delete next[id];
      return { manualOverrides: next };
    }),
  clearAllOverrides: () => set({ manualOverrides: {} }),

  nextStep: () =>
    set((state) => ({ currentStep: Math.min(state.currentStep + 1, 3) })),
  prevStep: () =>
    set((state) => ({ currentStep: Math.max(state.currentStep - 1, 0) })),
}));

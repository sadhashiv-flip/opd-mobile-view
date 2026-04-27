/** Placeholder list until prescriptions API is wired (GET + appointment_id). */
/** Optional per-slot instructions from LIST prescriptions (`morning` / `afternoon` / `night` / `weekly`). */
export type PharmacyMedicineSchedule = Readonly<{
  morning?: string;
  afternoon?: string;
  night?: string;
  weekly?: string;
}>;

export type PharmacyMockMedicine = Readonly<{
  name: string;
  form: string;
  durationLabel: string;
  frequencyLabel: string;
  schedule?: PharmacyMedicineSchedule;
}>;

export type PharmacyMockPrescription = Readonly<{
  /** Prescription record id (e.g. PRID…) — routes and cache. */
  prescriptionId: string;
  /** `POST /medicine` `prescription_id` for `FLIPHEALTH` — from API `appointment_id` when present. */
  appointmentId?: string;
  doctorName: string;
  specialty: string;
  dateLabel: string;
  medicineCount: number;
  symptoms: string;
  medicines: readonly PharmacyMockMedicine[];
  /** Flip `appointment` + prescription `notes` — detail screen only. */
  diagnosis?: string;
  recommendation?: string;
  notes?: string;
  purpose?: string;
}>;

export const PHARMACY_MOCK_PRESCRIPTIONS: readonly PharmacyMockPrescription[] = [
  {
    prescriptionId: "APP1001912D100049T1715151460",
    doctorName: "Dr. Nikhila",
    specialty: "General Medicine",
    dateLabel: "May 21, 2024",
    medicineCount: 1,
    symptoms: "feverish",
    medicines: [
      {
        name: "dolo",
        form: "Tablet",
        durationLabel: "1 Days",
        frequencyLabel: "3 times/week",
      },
    ],
  },
  {
    prescriptionId: "APP1001912D100049T1715151461",
    doctorName: "Dr. Rahul Verma",
    specialty: "General Medicine",
    dateLabel: "Apr 02, 2024",
    medicineCount: 2,
    symptoms: "cough",
    medicines: [
      {
        name: "Azithral",
        form: "Tablet",
        durationLabel: "3 Days",
        frequencyLabel: "Once daily",
      },
      {
        name: "Cetirizine",
        form: "Tablet",
        durationLabel: "5 Days",
        frequencyLabel: "At night",
      },
    ],
  },
  {
    prescriptionId: "APP1001912D100049T1715151462",
    doctorName: "Dr. Sneha K",
    specialty: "Pediatrics",
    dateLabel: "Mar 15, 2024",
    medicineCount: 1,
    symptoms: "mild fever",
    medicines: [
      {
        name: "Paracetamol",
        form: "Syrup",
        durationLabel: "2 Days",
        frequencyLabel: "As needed",
      },
    ],
  },
  {
    prescriptionId: "APP1001912D100049T1715151463",
    doctorName: "Dr. Arjun Mehta",
    specialty: "Orthopedics",
    dateLabel: "Feb 10, 2024",
    medicineCount: 1,
    symptoms: "joint pain",
    medicines: [
      {
        name: "Diclofenac",
        form: "Tablet",
        durationLabel: "7 Days",
        frequencyLabel: "Twice daily",
      },
    ],
  },
  {
    prescriptionId: "APP1001912D100049T1715151464",
    doctorName: "Dr. Priya Nair",
    specialty: "Dermatology",
    dateLabel: "Jan 22, 2024",
    medicineCount: 1,
    symptoms: "skin irritation",
    medicines: [
      {
        name: "Moisturizing lotion",
        form: "Topical",
        durationLabel: "14 Days",
        frequencyLabel: "Twice daily",
      },
    ],
  },
];

export function findMockPrescription(prescriptionId: string): PharmacyMockPrescription | null {
  const id = prescriptionId.trim();
  return PHARMACY_MOCK_PRESCRIPTIONS.find((p) => p.prescriptionId === id) ?? null;
}

/** Stable id for multi-select + `POST /medicine` — Flutter uses `appointmentId`. */
export function pharmacyFlipRxSelectionKey(rx: PharmacyMockPrescription): string {
  const a = rx.appointmentId?.trim();
  if (a) return a;
  return rx.prescriptionId.trim();
}

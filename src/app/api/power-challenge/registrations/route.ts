import { NextResponse, NextRequest } from "next/server";

const MOCK_REGISTRATIONS = [
  { id: "1", firstName: "John", lastName: "Smith", email: "john@example.com", phone: "954-555-0101", dob: "1990-05-15", gender: "Male", race: "500m", team: "Piranhas", emergencyName: "Jane Smith", emergencyPhone: "954-555-0102", medical: "", paymentStatus: "paid", registeredAt: "2026-03-10", stripeSessionId: "cs_test_001" },
  { id: "2", firstName: "Maria", lastName: "Garcia", email: "maria@example.com", phone: "954-555-0201", dob: "1985-08-22", gender: "Female", race: "1.5K", team: "Dolphins", emergencyName: "Carlos Garcia", emergencyPhone: "954-555-0202", medical: "Asthma", paymentStatus: "paid", registeredAt: "2026-03-11", stripeSessionId: "cs_test_002" },
  { id: "3", firstName: "Mike", lastName: "Johnson", email: "mike@example.com", phone: "954-555-0301", dob: "1995-01-10", gender: "Male", race: "500m", team: "", emergencyName: "Sarah Johnson", emergencyPhone: "954-555-0302", medical: "", paymentStatus: "pending", registeredAt: "2026-03-12", stripeSessionId: "" },
  { id: "4", firstName: "Lisa", lastName: "Chen", email: "lisa@example.com", phone: "954-555-0401", dob: "1992-11-03", gender: "Female", race: "1.5K", team: "Piranhas", emergencyName: "Wei Chen", emergencyPhone: "954-555-0402", medical: "", paymentStatus: "paid", registeredAt: "2026-03-12", stripeSessionId: "cs_test_004" },
  { id: "5", firstName: "David", lastName: "Brown", email: "david@example.com", phone: "954-555-0501", dob: "1988-07-19", gender: "Male", race: "500m", team: "Barracudas", emergencyName: "Amy Brown", emergencyPhone: "954-555-0502", medical: "None", paymentStatus: "paid", registeredAt: "2026-03-13", stripeSessionId: "cs_test_005" }
];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.toLowerCase() || "";
  const race = searchParams.get("race") || "";

  let results = MOCK_REGISTRATIONS;
  if (search) {
    results = results.filter(r =>
      `${r.firstName} ${r.lastName}`.toLowerCase().includes(search) ||
      r.email.toLowerCase().includes(search)
    );
  }
  if (race) {
    results = results.filter(r => r.race === race);
  }

  return NextResponse.json(results);
}

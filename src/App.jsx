import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import * as XLSX from "xlsx";

const COLORS = {
  bg: "#0a0f1e",
  surface: "#111827",
  card: "#1a2235",
  border: "#1e3a5f",
  accent: "#0ea5e9",
  accentDim: "#0369a1",
  success: "#10b981",
  warning: "#f59e0b",
  danger: "#ef4444",
  text: "#f1f5f9",
  textMuted: "#94a3b8",
  textDim: "#475569",
};

const toAppt = (r) => ({ ...r, patientId: r.patient_id });
const toTreat = (r) => ({ ...r, patientId: r.patient_id });

const treatmentCatalog = ["Limpieza dental", "Extracción simple", "Extracción quirúrgica", "Obturación resina", "Obturación amalgama", "Radiografía periapical", "Radiografía panorámica", "Blanqueamiento", "Corona cerámica", "Prótesis removible", "Implante", "Endodoncia", "Periodoncia", "Ortodoncia consulta", "Sellantes"];

const formatCLP = (n) => new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP" }).format(n);
const formatDate = (d) => { if (!d) return ""; const [y, m, day] = d.split("-"); return `${day}/${m}/${y}`; };
const today = () => new Date().toISOString().split("T")[0];

function StatusBadge({ status }) {
  const map = {
    confirmada: { color: COLORS.success, label: "Confirmada" },
    pendiente: { color: COLORS.warning, label: "Pendiente" },
    cancelada: { color: COLORS.danger, label: "Cancelada" },
    completada: { color: COLORS.textDim, label: "Completada" },
    "pendiente pago": { color: COLORS.warning, label: "Pend. Pago" },
    completado: { color: COLORS.success, label: "Completado" },
  };
  const s = map[status] || { color: COLORS.textMuted, label: status };
  return (
    <span style={{ background: s.color + "22", color: s.color, border: `1px solid ${s.color}44`, borderRadius: 6, padding: "2px 10px", fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function WhatsAppBtn({ phone, message }) {
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  return (
    <a href={url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#25D36622", color: "#25D366", border: "1px solid #25D36644", borderRadius: 8, padding: "6px 14px", fontSize: 13, fontWeight: 600, textDecoration: "none", cursor: "pointer" }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.122 1.523 5.855L.057 23.887a.75.75 0 00.921.921l6.032-1.466A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.712 9.712 0 01-4.952-1.356l-.355-.211-3.683.895.913-3.582-.231-.368A9.712 9.712 0 012.25 12C2.25 6.615 6.615 2.25 12 2.25S21.75 6.615 21.75 12 17.385 21.75 12 21.75z"/></svg>
      WhatsApp
    </a>
  );
}

function AgendaView({ appointments, patients, setAppointments, setView, setSelectedPatient }) {
  const [selectedDate, setSelectedDate] = useState(today());
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patientId: "", date: today(), time: "09:00", duration: 60, treatment: "Limpieza dental", dentist: "Dr. Rodrigo Soto", notes: "", status: "pendiente" });

  const dayAppts = appointments.filter(a => a.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time));
  const getPatient = (id) => patients.find(p => p.id === Number(id));

  const saveAppt = async () => {
    if (!form.patientId || !form.date || !form.time) return;
    const { data, error } = await supabase.from("appointments").insert([{
      patient_id: Number(form.patientId), date: form.date, time: form.time,
      duration: Number(form.duration), treatment: form.treatment,
      dentist: form.dentist, notes: form.notes, status: form.status,
    }]).select().single();
    if (!error) {
      setAppointments(prev => [...prev, toAppt(data)]);
      setShowForm(false);
      setSelectedDate(form.date);
    }
  };

  const updateStatus = async (id, status) => {
    await supabase.from("appointments").update({ status }).eq("id", id);
    setAppointments(prev => prev.map(a => a.id === id ? { ...a, status } : a));
  };

  const buildWAMessage = (appt) => {
    const p = getPatient(appt.patientId);
    return `Hola ${p?.name?.split(" ")[0]} 👋, le recordamos su cita en *Clínica Estética y Dental Olimpia* para el día *${formatDate(appt.date)}* a las *${appt.time} hrs* para *${appt.treatment}*.\n\nPor favor confirme respondiendo *SÍ* o escríbanos si necesita reagendar.\n\n📍 Arturo Prat 350, Of. 506, Temuco`;
  };

  const getWeekDays = () => {
    const d = new Date(selectedDate);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return Array.from({ length: 6 }, (_, i) => {
      const dd = new Date(monday);
      dd.setDate(monday.getDate() + i);
      return dd.toISOString().split("T")[0];
    });
  };
  const weekDays = getWeekDays();
  const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, overflowX: "auto", paddingBottom: 4 }}>
        {weekDays.map((d, i) => {
          const count = appointments.filter(a => a.date === d).length;
          const isToday = d === today();
          const isSelected = d === selectedDate;
          return (
            <button key={d} onClick={() => setSelectedDate(d)} style={{ flex: "0 0 auto", minWidth: 72, padding: "10px 8px", borderRadius: 10, border: `1px solid ${isSelected ? COLORS.accent : COLORS.border}`, background: isSelected ? COLORS.accent + "22" : COLORS.card, color: isSelected ? COLORS.accent : COLORS.text, cursor: "pointer", textAlign: "center" }}>
              <div style={{ fontSize: 11, color: isSelected ? COLORS.accent : COLORS.textMuted, marginBottom: 2 }}>{dayNames[i]}</div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>{d.split("-")[2]}</div>
              {count > 0 && <div style={{ marginTop: 4, background: COLORS.accent, borderRadius: 10, fontSize: 10, padding: "1px 6px", color: "#fff", fontWeight: 700 }}>{count}</div>}
              {isToday && <div style={{ fontSize: 9, color: COLORS.success, marginTop: 2 }}>HOY</div>}
            </button>
          );
        })}
        <button onClick={() => setShowForm(true)} style={{ flex: "0 0 auto", minWidth: 72, padding: "10px 8px", borderRadius: 10, border: `1px dashed ${COLORS.accent}`, background: "transparent", color: COLORS.accent, cursor: "pointer", fontSize: 22 }}>+</button>
      </div>

      <div style={{ marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h3 style={{ color: COLORS.text, margin: 0, fontSize: 16 }}>📅 {formatDate(selectedDate)} — {dayAppts.length} cita{dayAppts.length !== 1 ? "s" : ""}</h3>
        <button onClick={() => setShowForm(true)} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontWeight: 700, cursor: "pointer", fontSize: 13 }}>+ Nueva cita</button>
      </div>

      {dayAppts.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 0", color: COLORS.textDim }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🦷</div>
          <div>Sin citas para este día</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {dayAppts.map(appt => {
            const p = getPatient(appt.patientId);
            return (
              <div key={appt.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "16px 20px", borderLeft: `4px solid ${appt.status === "confirmada" ? COLORS.success : appt.status === "cancelada" ? COLORS.danger : COLORS.warning}` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
                  <div>
                    <div style={{ fontWeight: 700, color: COLORS.text, fontSize: 15 }}>{appt.time} hrs — {appt.treatment}</div>
                    <div style={{ color: COLORS.accent, fontSize: 13, marginTop: 3, cursor: "pointer" }}
                      onClick={() => { setSelectedPatient(p?.id); setView("patients"); }}>
                      👤 {p?.name || "Paciente desconocido"}
                    </div>
                    <div style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>⏱ {appt.duration} min · {appt.dentist}</div>
                    {appt.notes && <div style={{ color: COLORS.textDim, fontSize: 12, marginTop: 4 }}>📝 {appt.notes}</div>}
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
                    <StatusBadge status={appt.status} />
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {appt.status === "pendiente" && (
                        <button onClick={() => updateStatus(appt.id, "confirmada")} style={{ background: COLORS.success + "22", color: COLORS.success, border: `1px solid ${COLORS.success}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✓ Confirmar</button>
                      )}
                      {appt.status !== "cancelada" && appt.status !== "completada" && (
                        <button onClick={() => updateStatus(appt.id, "cancelada")} style={{ background: COLORS.danger + "22", color: COLORS.danger, border: `1px solid ${COLORS.danger}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✕ Cancelar</button>
                      )}
                      {appt.status === "confirmada" && (
                        <button onClick={() => updateStatus(appt.id, "completada")} style={{ background: COLORS.textDim + "22", color: COLORS.textMuted, border: `1px solid ${COLORS.textDim}44`, borderRadius: 6, padding: "4px 10px", fontSize: 11, cursor: "pointer", fontWeight: 600 }}>✓ Completar</button>
                      )}
                    </div>
                    {p?.phone && <WhatsAppBtn phone={p.phone} message={buildWAMessage(appt)} />}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ color: COLORS.text, margin: "0 0 20px" }}>Nueva Cita</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Paciente", key: "patientId", type: "select", options: patients.map(p => ({ value: p.id, label: p.name })) },
                { label: "Fecha", key: "date", type: "date" },
                { label: "Hora", key: "time", type: "time" },
                { label: "Duración (min)", key: "duration", type: "number" },
                { label: "Tratamiento", key: "treatment", type: "select", options: treatmentCatalog.map(t => ({ value: t, label: t })) },
                { label: "Dentista", key: "dentist", type: "text" },
                { label: "Notas", key: "notes", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ color: COLORS.textMuted, fontSize: 12, display: "block", marginBottom: 4 }}>{f.label}</label>
                  {f.type === "select" ? (
                    <select value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle}>
                      <option value="">Seleccionar...</option>
                      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={saveAppt} style={{ flex: 1, background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: COLORS.card, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PatientsView({ patients, setPatients, appointments, treatments, selectedPatient, setSelectedPatient }) {
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [form, setForm] = useState({ name: "", rut: "", phone: "", email: "", dob: "", address: "", notes: "" });
  const [editForm, setEditForm] = useState({ name: "", rut: "", phone: "", email: "", dob: "", address: "", notes: "" });
  const [detail, setDetail] = useState(selectedPatient || null);

  useEffect(() => { if (selectedPatient) setDetail(selectedPatient); }, [selectedPatient]);

  const normalizeRut = (r) => (r || "").replace(/[.\-]/g, "").toLowerCase();
  const filtered = patients.filter(p => {
    const q = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      normalizeRut(p.rut).includes(normalizeRut(search)) ||
      (p.phone || "").includes(q) ||
      (p.email || "").toLowerCase().includes(q)
    );
  });

  const savePatient = async () => {
    if (!form.name) return;
    const { data, error } = await supabase.from("patients").insert([{
      name: form.name, rut: form.rut, phone: form.phone, email: form.email,
      dob: form.dob, address: form.address, notes: form.notes,
    }]).select().single();
    if (!error) {
      setPatients(prev => [...prev, data]);
      setForm({ name: "", rut: "", phone: "", email: "", dob: "", address: "", notes: "" });
      setShowForm(false);
    }
  };

  const parseWhatsApp = (text) => {
    const rut = text.match(/\b\d{1,2}\.?\d{3}\.?\d{3}-?[\dkK]\b/)?.[0] || "";
    const email = text.match(/[\w.-]+@[\w.-]+\.\w+/)?.[0] || "";
    const phone = text.match(/(?:56\s?)?(?:9\s?\d{4}\s?\d{4}|\d{8,9})/)?.[0]?.replace(/\s/g, "") || "";
    const fullPhone = phone && !phone.startsWith("56") ? "56" + phone.replace(/^0/, "") : phone;
    const dob = text.match(/\b(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})\b/);
    const dobFormatted = dob ? `${dob[3]}-${dob[2].padStart(2,"0")}-${dob[1].padStart(2,"0")}` : "";
    // Extraer nombre: líneas sin números que parezcan nombre
    const lines = text.split(/\n|,/).map(l => l.trim()).filter(Boolean);
    const nameLine = lines.find(l => /^[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?: [A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+$/.test(l)) || "";
    // Buscar dirección: línea con calle, av, pasaje, etc.
    const addressLine = lines.find(l => /(?:calle|av\.|avenida|pasaje|villa|pje|sector|block|bl\.|#|\d+.*temuco|temuco)/i.test(l)) || "";
    // Notas: buscar alergias o condiciones
    const notesLine = lines.find(l => /(?:alérgic|alergic|diabét|hipert|medicament|no puede|toma)/i.test(l)) || "";
    setForm(f => ({
      ...f,
      name: nameLine || f.name,
      rut: rut || f.rut,
      phone: fullPhone || f.phone,
      email: email || f.email,
      dob: dobFormatted || f.dob,
      address: addressLine || f.address,
      notes: notesLine || f.notes,
    }));
  };

  const updatePatient = async (id) => {
    if (!editForm.name) return;
    const { data, error } = await supabase.from("patients").update({
      name: editForm.name, rut: editForm.rut, phone: editForm.phone, email: editForm.email,
      dob: editForm.dob, address: editForm.address, notes: editForm.notes,
    }).eq("id", id).select().single();
    if (!error) {
      setPatients(prev => prev.map(p => p.id === id ? data : p));
      setShowEditForm(false);
    }
  };

  if (detail) {
    const p = patients.find(pt => pt.id === detail);
    if (!p) { setDetail(null); setSelectedPatient(null); return null; }
    const pAppts = appointments.filter(a => a.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const pTreat = treatments.filter(t => t.patientId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const totalDebt = pTreat.reduce((s, t) => s + (t.cost - t.paid), 0);

    const fields = [
      { label: "Nombre completo *", key: "name", type: "text" },
      { label: "RUT", key: "rut", type: "text" },
      { label: "Teléfono", key: "phone", type: "text" },
      { label: "Email", key: "email", type: "email" },
      { label: "Fecha de nacimiento", key: "dob", type: "date" },
      { label: "Dirección", key: "address", type: "text" },
      { label: "Alertas / Alergias", key: "notes", type: "text" },
    ];

    return (
      <div>
        <button onClick={() => { setDetail(null); setSelectedPatient(null); }} style={{ background: "none", border: "none", color: COLORS.accent, cursor: "pointer", marginBottom: 16, fontSize: 14 }}>← Volver a pacientes</button>
        <div style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 24, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
            <div>
              <h2 style={{ color: COLORS.text, margin: "0 0 8px", fontSize: 22 }}>{p.name}</h2>
              <div style={{ color: COLORS.textMuted, fontSize: 13, display: "flex", flexDirection: "column", gap: 3 }}>
                <span>🪪 {p.rut}</span>
                <span>📱 {p.phone} — <WhatsAppBtn phone={p.phone} message={`Hola ${p.name.split(" ")[0]}, le escribimos desde Clínica Olimpia 🦷`} /></span>
                <span>✉️ {p.email}</span>
                <span>🎂 {formatDate(p.dob)}</span>
                <span>📍 {p.address}</span>
              </div>
              {p.notes && <div style={{ marginTop: 10, background: COLORS.warning + "11", border: `1px solid ${COLORS.warning}33`, borderRadius: 8, padding: "8px 12px", color: COLORS.warning, fontSize: 13 }}>⚠️ {p.notes}</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ color: COLORS.textMuted, fontSize: 12 }}>Saldo pendiente</div>
                <div style={{ color: totalDebt > 0 ? COLORS.danger : COLORS.success, fontWeight: 700, fontSize: 24 }}>{formatCLP(totalDebt)}</div>
              </div>
              <button onClick={() => { setEditForm({ name: p.name, rut: p.rut || "", phone: p.phone || "", email: p.email || "", dob: p.dob || "", address: p.address || "", notes: p.notes || "" }); setShowEditForm(true); }}
                style={{ background: COLORS.accent + "22", color: COLORS.accent, border: `1px solid ${COLORS.accent}44`, borderRadius: 8, padding: "6px 14px", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                ✏️ Editar
              </button>
            </div>
          </div>
        </div>

        {showEditForm && (
          <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
            <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
              <h3 style={{ color: COLORS.text, margin: "0 0 20px" }}>Editar Paciente</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {fields.map(f => (
                  <div key={f.key}>
                    <label style={{ color: COLORS.textMuted, fontSize: 12, display: "block", marginBottom: 4 }}>{f.label}</label>
                    <input type={f.type} value={editForm[f.key]} onChange={e => setEditForm(prev => ({ ...prev, [f.key]: e.target.value }))} style={inputStyle} />
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
                <button onClick={() => updatePatient(p.id)} style={{ flex: 1, background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer" }}>Guardar cambios</button>
                <button onClick={() => setShowEditForm(false)} style={{ flex: 1, background: COLORS.card, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer" }}>Cancelar</button>
              </div>
            </div>
          </div>
        )}

        <h3 style={{ color: COLORS.text, marginBottom: 12 }}>Citas</h3>
        {pAppts.length === 0 ? <div style={{ color: COLORS.textDim, marginBottom: 20 }}>Sin citas registradas</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 24 }}>
            {pAppts.map(a => (
              <div key={a.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ color: COLORS.text, fontWeight: 600 }}>{formatDate(a.date)} {a.time} — {a.treatment}</div>
                  <div style={{ color: COLORS.textMuted, fontSize: 12 }}>{a.dentist}</div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            ))}
          </div>
        )}

        <h3 style={{ color: COLORS.text, marginBottom: 12 }}>Historial clínico</h3>
        {pTreat.length === 0 ? <div style={{ color: COLORS.textDim }}>Sin tratamientos registrados</div> : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pTreat.map(t => (
              <div key={t.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ color: COLORS.text, fontWeight: 600 }}>{formatDate(t.date)} — {t.procedure}</div>
                  {t.tooth !== "-" && <div style={{ color: COLORS.textMuted, fontSize: 12 }}>Pieza: {t.tooth}</div>}
                  {t.notes && <div style={{ color: COLORS.textDim, fontSize: 12 }}>{t.notes}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: COLORS.text, fontWeight: 700 }}>{formatCLP(t.cost)}</div>
                  <div style={{ color: t.cost === t.paid ? COLORS.success : COLORS.danger, fontSize: 12 }}>Pagado: {formatCLP(t.paid)}</div>
                  <StatusBadge status={t.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 8 }}>
        <div style={{ position: "relative", flex: 1 }}>
          <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: COLORS.textDim, fontSize: 16 }}>🔍</span>
          <input
            placeholder="Buscar por nombre, RUT o teléfono..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ ...inputStyle, paddingLeft: 38, width: "100%" }}
          />
          {search && (
            <button onClick={() => setSearch("")} style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", color: COLORS.textDim, cursor: "pointer", fontSize: 18, lineHeight: 1 }}>×</button>
          )}
        </div>
        <button onClick={() => setShowForm(true)} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>+ Paciente</button>
      </div>

      <div style={{ color: COLORS.textDim, fontSize: 12, marginBottom: 14 }}>
        {search ? `${filtered.length} resultado${filtered.length !== 1 ? "s" : ""} para "${search}"` : `${patients.length} paciente${patients.length !== 1 ? "s" : ""} en total`}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtered.length === 0 && search && (
          <div style={{ textAlign: "center", color: COLORS.textDim, padding: 40 }}>No se encontró ningún paciente con "{search}"</div>
        )}
        {filtered.map(p => (
          <div key={p.id} onClick={() => setDetail(p.id)} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 18px", cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ color: COLORS.text, fontWeight: 600, fontSize: 15 }}>{p.name}</div>
              <div style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>{p.rut} · {p.phone}</div>
              {p.notes && <div style={{ color: COLORS.warning, fontSize: 11, marginTop: 2 }}>⚠️ {p.notes}</div>}
            </div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
              <span style={{ color: COLORS.textDim, fontSize: 12 }}>{appointments.filter(a => a.patientId === p.id).length} citas</span>
              <span style={{ color: COLORS.accent, fontSize: 12 }}>Ver ficha →</span>
            </div>
          </div>
        ))}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ color: COLORS.text, margin: "0 0 16px" }}>Nuevo Paciente</h3>

            {/* Pegar desde WhatsApp */}
            <div style={{ background: "#25D36611", border: "1px dashed #25D36644", borderRadius: 10, padding: 12, marginBottom: 18 }}>
              <div style={{ color: "#25D366", fontSize: 12, fontWeight: 700, marginBottom: 6 }}>📋 Pegar texto de WhatsApp</div>
              <textarea
                placeholder={"Pega aquí el mensaje del paciente...\nEj: Hola, soy María González, RUT 12.345.678-9, teléfono 56912345678, vivo en Los Robles 123 Temuco"}
                onPaste={e => { setTimeout(() => parseWhatsApp(e.target.value), 50); }}
                onChange={e => parseWhatsApp(e.target.value)}
                style={{ ...inputStyle, height: 80, resize: "vertical", fontSize: 12, color: COLORS.textMuted }}
              />
              <div style={{ color: COLORS.textDim, fontSize: 11, marginTop: 4 }}>Los datos se rellenan automáticamente abajo. Revisa y corrige si es necesario.</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Nombre completo *", key: "name", type: "text" },
                { label: "RUT", key: "rut", type: "text" },
                { label: "Teléfono (56912345678)", key: "phone", type: "text" },
                { label: "Email", key: "email", type: "email" },
                { label: "Fecha de nacimiento", key: "dob", type: "date" },
                { label: "Dirección", key: "address", type: "text" },
                { label: "Alertas / Alergias", key: "notes", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ color: COLORS.textMuted, fontSize: 12, display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={{ ...inputStyle, borderColor: form[f.key] ? COLORS.accent + "66" : COLORS.border }} />
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={savePatient} style={{ flex: 1, background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
              <button onClick={() => { setShowForm(false); setForm({ name: "", rut: "", phone: "", email: "", dob: "", address: "", notes: "" }); }} style={{ flex: 1, background: COLORS.card, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TreatmentsView({ treatments, setTreatments, patients }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ patientId: "", date: today(), procedure: "Limpieza dental", tooth: "-", cost: "", paid: "", status: "completado", notes: "" });

  const getPatient = (id) => patients.find(p => p.id === Number(id));

  const save = async () => {
    if (!form.patientId || !form.procedure) return;
    const { data, error } = await supabase.from("treatments").insert([{
      patient_id: Number(form.patientId), date: form.date, procedure: form.procedure,
      tooth: form.tooth, cost: Number(form.cost), paid: Number(form.paid),
      status: form.status, notes: form.notes,
    }]).select().single();
    if (!error) {
      setTreatments(prev => [...prev, toTreat(data)]);
      setShowForm(false);
    }
  };

  const registerPayment = async (id, amount) => {
    const t = treatments.find(t => t.id === id);
    const newPaid = Math.min(t.paid + amount, t.cost);
    const newStatus = newPaid >= t.cost ? "completado" : "pendiente pago";
    await supabase.from("treatments").update({ paid: newPaid, status: newStatus }).eq("id", id);
    setTreatments(prev => prev.map(t => t.id === id ? { ...t, paid: newPaid, status: newStatus } : t));
  };

  const sorted = [...treatments].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
        <button onClick={() => setShowForm(true)} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "8px 18px", fontWeight: 700, cursor: "pointer" }}>+ Tratamiento</button>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {sorted.map(t => {
          const p = getPatient(t.patientId);
          const debt = t.cost - t.paid;
          return (
            <div key={t.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 12, padding: "14px 18px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <div style={{ color: COLORS.text, fontWeight: 600 }}>{p?.name} — {t.procedure}</div>
                  <div style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>📅 {formatDate(t.date)}{t.tooth !== "-" ? ` · Pieza ${t.tooth}` : ""}</div>
                  {t.notes && <div style={{ color: COLORS.textDim, fontSize: 12 }}>{t.notes}</div>}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ color: COLORS.text, fontWeight: 700, fontSize: 16 }}>{formatCLP(t.cost)}</div>
                  <div style={{ fontSize: 12, color: debt > 0 ? COLORS.danger : COLORS.success }}>
                    {debt > 0 ? `Debe: ${formatCLP(debt)}` : "✓ Pagado"}
                  </div>
                  <StatusBadge status={t.status} />
                </div>
              </div>
              {debt > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {[debt / 2, debt].map((amt, i) => (
                    <button key={i} onClick={() => registerPayment(t.id, amt)} style={{ background: COLORS.success + "22", color: COLORS.success, border: `1px solid ${COLORS.success}44`, borderRadius: 6, padding: "4px 12px", fontSize: 12, cursor: "pointer", fontWeight: 600 }}>
                      Registrar {i === 0 ? "50%" : "pago total"} ({formatCLP(amt)})
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "#00000088", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 16, padding: 28, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto" }}>
            <h3 style={{ color: COLORS.text, margin: "0 0 20px" }}>Nuevo Tratamiento</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {[
                { label: "Paciente", key: "patientId", type: "select", options: patients.map(p => ({ value: p.id, label: p.name })) },
                { label: "Fecha", key: "date", type: "date" },
                { label: "Procedimiento", key: "procedure", type: "select", options: treatmentCatalog.map(t => ({ value: t, label: t })) },
                { label: "Pieza dental (ej: 36)", key: "tooth", type: "text" },
                { label: "Costo total ($)", key: "cost", type: "number" },
                { label: "Monto pagado ($)", key: "paid", type: "number" },
                { label: "Notas", key: "notes", type: "text" },
              ].map(f => (
                <div key={f.key}>
                  <label style={{ color: COLORS.textMuted, fontSize: 12, display: "block", marginBottom: 4 }}>{f.label}</label>
                  {f.type === "select" ? (
                    <select value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle}>
                      <option value="">Seleccionar...</option>
                      {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  ) : (
                    <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} style={inputStyle} />
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button onClick={save} style={{ flex: 1, background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "10px", fontWeight: 700, cursor: "pointer" }}>Guardar</button>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: COLORS.card, color: COLORS.textMuted, border: `1px solid ${COLORS.border}`, borderRadius: 8, padding: "10px", cursor: "pointer" }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DashboardView({ appointments, treatments, patients, setView }) {
  const todayAppts = appointments.filter(a => a.date === today());
  const pending = appointments.filter(a => a.status === "pendiente").length;
  const confirmed = appointments.filter(a => a.status === "confirmada").length;
  const totalDebt = treatments.reduce((s, t) => s + (t.cost - t.paid), 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthRevenue = treatments.filter(t => t.date.startsWith(thisMonth)).reduce((s, t) => s + t.paid, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 24 }}>
        {[
          { label: "Citas hoy", value: todayAppts.length, color: COLORS.accent, icon: "📅" },
          { label: "Confirmadas", value: confirmed, color: COLORS.success, icon: "✅" },
          { label: "Pendientes", value: pending, color: COLORS.warning, icon: "⏳" },
          { label: "Pacientes", value: patients.length, color: COLORS.accent, icon: "👥" },
          { label: "Ingreso mes", value: formatCLP(monthRevenue), color: COLORS.success, icon: "💰", small: true },
          { label: "Por cobrar", value: formatCLP(totalDebt), color: COLORS.danger, icon: "💸", small: true },
        ].map(card => (
          <div key={card.label} style={{ background: COLORS.card, border: `1px solid ${card.color}33`, borderRadius: 12, padding: "16px 14px" }}>
            <div style={{ fontSize: 22, marginBottom: 6 }}>{card.icon}</div>
            <div style={{ color: card.color, fontWeight: 700, fontSize: card.small ? 16 : 28 }}>{card.value}</div>
            <div style={{ color: COLORS.textMuted, fontSize: 12, marginTop: 2 }}>{card.label}</div>
          </div>
        ))}
      </div>

      <h3 style={{ color: COLORS.text, marginBottom: 12 }}>Citas de hoy</h3>
      {todayAppts.length === 0 ? (
        <div style={{ color: COLORS.textDim, padding: "30px 0", textAlign: "center" }}>Sin citas para hoy</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {todayAppts.sort((a, b) => a.time.localeCompare(b.time)).map(a => {
            const p = patients.find(pt => pt.id === a.patientId);
            return (
              <div key={a.id} style={{ background: COLORS.card, border: `1px solid ${COLORS.border}`, borderRadius: 10, padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                <div>
                  <span style={{ color: COLORS.accent, fontWeight: 700, marginRight: 10 }}>{a.time}</span>
                  <span style={{ color: COLORS.text }}>{p?.name} — {a.treatment}</span>
                </div>
                <StatusBadge status={a.status} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%", boxSizing: "border-box", background: "#0d1b2a", border: `1px solid ${COLORS.border}`,
  borderRadius: 8, padding: "9px 12px", color: COLORS.text, fontSize: 14, outline: "none",
};

function RegistroView() {
  const [form, setForm] = useState({ name: "", rut: "", phone: "", email: "", dob: "", address: "", notes: "" });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.rut || !form.phone) { setError("Nombre, RUT y teléfono son obligatorios."); return; }
    setLoading(true);
    setError("");
    const { error } = await supabase.from("patients").insert([{
      name: form.name, rut: form.rut, phone: form.phone,
      email: form.email, dob: form.dob, address: form.address, notes: form.notes,
    }]);
    if (error) { setError("Error al guardar. Intenta nuevamente."); setLoading(false); }
    else setSent(true);
  };

  if (sent) return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: 40, width: "100%", maxWidth: 420, textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
        <h2 style={{ color: COLORS.text, margin: "0 0 10px" }}>¡Datos recibidos!</h2>
        <p style={{ color: COLORS.textMuted, fontSize: 14, margin: 0 }}>Gracias {form.name.split(" ")[0]}, tus datos fueron registrados correctamente en Clínica Olimpia. Te contactaremos pronto.</p>
        <div style={{ marginTop: 24, color: COLORS.textDim, fontSize: 12 }}>🦷 Clínica Estética y Dental Olimpia · Arturo Prat 350, Of. 506, Temuco</div>
      </div>
    </div>
  );

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: 32, width: "100%", maxWidth: 480 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 42, marginBottom: 8 }}>🦷</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.text }}>Registro de Paciente</div>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>Clínica Estética y Dental Olimpia · Temuco</div>
        </div>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[
            { label: "Nombre completo *", key: "name", type: "text", placeholder: "Ej: Juan Pérez González" },
            { label: "RUT *", key: "rut", type: "text", placeholder: "Ej: 12.345.678-9" },
            { label: "Teléfono *", key: "phone", type: "text", placeholder: "Ej: 56912345678" },
            { label: "Email", key: "email", type: "email", placeholder: "correo@ejemplo.com" },
            { label: "Fecha de nacimiento", key: "dob", type: "date" },
            { label: "Dirección", key: "address", type: "text", placeholder: "Calle y número" },
            { label: "Alergias o condiciones importantes", key: "notes", type: "text", placeholder: "Ej: Alérgico a penicilina" },
          ].map(f => (
            <div key={f.key}>
              <label style={{ color: COLORS.textMuted, fontSize: 12, display: "block", marginBottom: 4 }}>{f.label}</label>
              <input type={f.type} value={form[f.key]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} placeholder={f.placeholder || ""} style={inputStyle} />
            </div>
          ))}
          {error && <div style={{ color: COLORS.danger, fontSize: 13, textAlign: "center" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "12px", fontWeight: 700, cursor: "pointer", fontSize: 15, marginTop: 4 }}>
            {loading ? "Guardando..." : "Enviar mis datos"}
          </button>
        </form>
      </div>
    </div>
  );
}

function LoginView({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) { setError("Email o contraseña incorrectos"); setLoading(false); }
    else onLogin();
  };

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
      <div style={{ background: COLORS.surface, border: `1px solid ${COLORS.border}`, borderRadius: 20, padding: 36, width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 48, marginBottom: 10 }}>🦷</div>
          <div style={{ fontWeight: 800, fontSize: 20, color: COLORS.text }}>Clínica Olimpia</div>
          <div style={{ fontSize: 12, color: COLORS.textDim, marginTop: 4 }}>Arturo Prat 350, Of. 506 · Temuco</div>
        </div>
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ color: COLORS.textMuted, fontSize: 12, display: "block", marginBottom: 4 }}>Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required autoFocus />
          </div>
          <div>
            <label style={{ color: COLORS.textMuted, fontSize: 12, display: "block", marginBottom: 4 }}>Contraseña</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required />
          </div>
          {error && <div style={{ color: COLORS.danger, fontSize: 13, textAlign: "center" }}>{error}</div>}
          <button type="submit" disabled={loading} style={{ background: COLORS.accent, color: "#fff", border: "none", borderRadius: 8, padding: "11px", fontWeight: 700, cursor: "pointer", fontSize: 15, marginTop: 4 }}>
            {loading ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  // Mostrar formulario público si la URL tiene #registro
  if (window.location.hash === "#registro") return <RegistroView />;

  const [view, setView] = useState("dashboard");
  const [patients, setPatients] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);
  const [copied, setCopied] = useState(false);

  const shareLink = `${window.location.origin}${window.location.pathname}registro/`;
  const copyLink = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) loadData();
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setSession(session);
      if (session) loadData();
    });
    return () => subscription.unsubscribe();
  }, []);

  const loadData = () => {
    setLoading(true);
    Promise.all([
      supabase.from("patients").select("*").order("name"),
      supabase.from("appointments").select("*").order("date"),
      supabase.from("treatments").select("*").order("date", { ascending: false }),
    ]).then(([p, a, t]) => {
      setPatients(p.data || []);
      setAppointments((a.data || []).map(toAppt));
      setTreatments((t.data || []).map(toTreat));
      setLoading(false);
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setPatients([]); setAppointments([]); setTreatments([]);
  };

  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();

    // Hoja 1: Pacientes
    const pacientesData = patients.map(p => ({
      "Nombre": p.name,
      "RUT": p.rut || "",
      "Teléfono": p.phone || "",
      "Email": p.email || "",
      "Fecha Nacimiento": p.dob ? formatDate(p.dob) : "",
      "Dirección": p.address || "",
      "Alertas/Alergias": p.notes || "",
      "Fecha Registro": p.created_at ? new Date(p.created_at).toLocaleDateString("es-CL") : "",
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pacientesData), "Pacientes");

    // Hoja 2: Citas
    const citasData = appointments.map(a => {
      const p = patients.find(pt => pt.id === a.patientId);
      return {
        "Fecha": formatDate(a.date),
        "Hora": a.time,
        "Paciente": p?.name || "",
        "RUT": p?.rut || "",
        "Teléfono": p?.phone || "",
        "Tratamiento": a.treatment,
        "Dentista": a.dentist || "",
        "Estado": a.status,
        "Duración (min)": a.duration || 60,
        "Notas": a.notes || "",
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(citasData), "Citas");

    // Hoja 3: Historial Clínico
    const clinicaData = treatments.map(t => {
      const p = patients.find(pt => pt.id === t.patientId);
      return {
        "Fecha": formatDate(t.date),
        "Paciente": p?.name || "",
        "RUT": p?.rut || "",
        "Procedimiento": t.procedure || "",
        "Pieza Dental": t.tooth || "",
        "Costo": t.cost || 0,
        "Pagado": t.paid || 0,
        "Saldo": (t.cost || 0) - (t.paid || 0),
        "Estado": t.status || "",
        "Notas": t.notes || "",
      };
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clinicaData), "Historial Clínico");

    const fecha = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Clinica_Olimpia_${fecha}.xlsx`);
  };

  const tabs = [
    { id: "dashboard", label: "Inicio", icon: "🏠" },
    { id: "agenda", label: "Agenda", icon: "📅" },
    { id: "patients", label: "Pacientes", icon: "👥" },
    { id: "treatments", label: "Clínico", icon: "🦷" },
  ];

  if (loading) return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 16 }}>
      <div style={{ fontSize: 40 }}>🦷</div>
      <div style={{ color: COLORS.textMuted, fontSize: 14 }}>Cargando...</div>
    </div>
  );

  if (!session) return <LoginView onLogin={loadData} />;

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, fontFamily: "'Segoe UI', system-ui, sans-serif", color: COLORS.text }}>
      <div style={{ background: COLORS.surface, borderBottom: `1px solid ${COLORS.border}`, padding: "14px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 800, fontSize: 16, color: COLORS.text, letterSpacing: -0.5 }}>🦷 Clínica Olimpia</div>
          <div style={{ fontSize: 11, color: COLORS.textDim }}>Arturo Prat 350, Of. 506 · Temuco</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button onClick={exportarExcel} style={{ background: "#10b98122", color: COLORS.success, border: `1px solid #10b98144`, borderRadius: 6, cursor: "pointer", fontSize: 11, padding: "4px 10px", fontWeight: 600 }}>
            📥 Exportar Excel
          </button>
          <button onClick={copyLink} style={{ background: copied ? COLORS.success + "22" : COLORS.accent + "22", color: copied ? COLORS.success : COLORS.accent, border: `1px solid ${copied ? COLORS.success : COLORS.accent}44`, borderRadius: 6, cursor: "pointer", fontSize: 11, padding: "4px 10px", fontWeight: 600 }}>
            {copied ? "✓ Copiado" : "🔗 Compartir registro"}
          </button>
          <button onClick={handleLogout} style={{ background: "none", border: `1px solid ${COLORS.border}`, borderRadius: 6, color: COLORS.textMuted, cursor: "pointer", fontSize: 11, padding: "4px 10px" }}>Salir</button>
        </div>
      </div>

      <div style={{ padding: "20px 16px", maxWidth: 700, margin: "0 auto", paddingBottom: 90 }}>
        {view === "dashboard" && <DashboardView appointments={appointments} treatments={treatments} patients={patients} setView={setView} />}
        {view === "agenda" && <AgendaView appointments={appointments} patients={patients} setAppointments={setAppointments} setView={setView} setSelectedPatient={setSelectedPatient} />}
        {view === "patients" && <PatientsView patients={patients} setPatients={setPatients} appointments={appointments} treatments={treatments} selectedPatient={selectedPatient} setSelectedPatient={setSelectedPatient} />}
        {view === "treatments" && <TreatmentsView treatments={treatments} setTreatments={setTreatments} patients={patients} />}
      </div>

      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: COLORS.surface, borderTop: `1px solid ${COLORS.border}`, display: "flex", justifyContent: "space-around", padding: "8px 0 12px" }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setView(t.id)} style={{ background: "none", border: "none", color: view === t.id ? COLORS.accent : COLORS.textDim, cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, padding: "4px 16px" }}>
            <span style={{ fontSize: 20 }}>{t.icon}</span>
            <span style={{ fontSize: 10, fontWeight: view === t.id ? 700 : 400 }}>{t.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function _unused() {
  return (
    <>
      <section id="center">
        <div className="hero">
          <img src={heroImg} className="base" width="170" height="179" alt="" />
          <img src={reactLogo} className="framework" alt="React logo" />
          <img src={viteLogo} className="vite" alt="Vite logo" />
        </div>
        <div>
          <h1>Get started</h1>
          <p>
            Edit <code>src/App.jsx</code> and save to test <code>HMR</code>
          </p>
        </div>
        <button
          type="button"
          className="counter"
          onClick={() => setCount((count) => count + 1)}
        >
          Count is {count}
        </button>
      </section>

      <div className="ticks"></div>

      <section id="next-steps">
        <div id="docs">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#documentation-icon"></use>
          </svg>
          <h2>Documentation</h2>
          <p>Your questions, answered</p>
          <ul>
            <li>
              <a href="https://vite.dev/" target="_blank">
                <img className="logo" src={viteLogo} alt="" />
                Explore Vite
              </a>
            </li>
            <li>
              <a href="https://react.dev/" target="_blank">
                <img className="button-icon" src={reactLogo} alt="" />
                Learn more
              </a>
            </li>
          </ul>
        </div>
        <div id="social">
          <svg className="icon" role="presentation" aria-hidden="true">
            <use href="/icons.svg#social-icon"></use>
          </svg>
          <h2>Connect with us</h2>
          <p>Join the Vite community</p>
          <ul>
            <li>
              <a href="https://github.com/vitejs/vite" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#github-icon"></use>
                </svg>
                GitHub
              </a>
            </li>
            <li>
              <a href="https://chat.vite.dev/" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#discord-icon"></use>
                </svg>
                Discord
              </a>
            </li>
            <li>
              <a href="https://x.com/vite_js" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#x-icon"></use>
                </svg>
                X.com
              </a>
            </li>
            <li>
              <a href="https://bsky.app/profile/vite.dev" target="_blank">
                <svg
                  className="button-icon"
                  role="presentation"
                  aria-hidden="true"
                >
                  <use href="/icons.svg#bluesky-icon"></use>
                </svg>
                Bluesky
              </a>
            </li>
          </ul>
        </div>
      </section>

    </>
  )
}

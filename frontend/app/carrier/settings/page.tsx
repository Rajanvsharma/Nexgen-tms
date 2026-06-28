'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import CarrierTopbar from '@/components/layout/CarrierTopbar';
import api from '@/lib/api';

interface PortalUser { id:string; firstName:string; lastName:string; email:string; phone:string|null; }
interface PortalCarrier {
  id:string; name:string; mcNumber:string; dotNumber:string|null;
  email:string|null; phone:string|null; address:string|null;
  city:string|null; state:string|null; zipCode:string|null;
  equipmentTypes:string[]; contactPerson:string|null;
  insuranceExpiry:string|null; authorityExpiry:string|null; w9OnFile:boolean; status:string;
}

type Msg = { type:'success'|'error'; text:string };

const EQUIPMENT_TYPES = ['Dry Van','Reefer','Flatbed','Step Deck','RGN','Conestoga','Power Only','Partial','LTL','Box Truck','Sprinter'];

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase' }}>{label}</label>
      {children}
    </div>
  );
}
const inp: React.CSSProperties = { width:'100%', height:38, padding:'0 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#0f172a', background:'#fafafa', boxSizing:'border-box', outline:'none' };
const readonlyInp: React.CSSProperties = { ...inp, background:'#f1f5f9', color:'#94a3b8', cursor:'not-allowed' };

export default function CarrierSettingsPage() {
  const { user } = useAuthStore();
  const [portalUser,  setPortalUser]  = useState<PortalUser|null>(null);
  const [carrier,     setCarrier]     = useState<PortalCarrier|null>(null);
  const [profileForm, setProfileForm] = useState({ firstName:'', lastName:'', phone:'' });
  const [companyForm, setCompanyForm] = useState({ phone:'', email:'', address:'', city:'', state:'', zipCode:'', contactPerson:'', dotNumber:'', equipmentTypes:[] as string[] });
  const [pwForm,      setPwForm]      = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [saving,      setSaving]      = useState(false);
  const [savingCo,    setSavingCo]    = useState(false);
  const [savingPw,    setSavingPw]    = useState(false);
  const [msg,         setMsg]         = useState<Msg|null>(null);
  const [coMsg,       setCoMsg]       = useState<Msg|null>(null);
  const [pwMsg,       setPwMsg]       = useState<Msg|null>(null);

  useEffect(() => {
    api.get('/carrier-portal/me').then(r => {
      setPortalUser(r.data.user);
      setCarrier(r.data.carrier);
      setProfileForm({ firstName:r.data.user?.firstName??'', lastName:r.data.user?.lastName??'', phone:r.data.user?.phone??'' });
      if (r.data.carrier) {
        const c = r.data.carrier;
        setCompanyForm({ phone:c.phone??'', email:c.email??'', address:c.address??'', city:c.city??'', state:c.state??'', zipCode:c.zipCode??'', contactPerson:c.contactPerson??'', dotNumber:c.dotNumber??'', equipmentTypes:c.equipmentTypes??[] });
      }
    });
  }, []);

  async function saveProfile() {
    setSaving(true); setMsg(null);
    try { await api.put('/carrier-portal/me', profileForm); setMsg({ type:'success', text:'Profile updated.' }); }
    catch(e:unknown) { setMsg({ type:'error', text:(e as {response?:{data?:{message?:string}}})?.response?.data?.message ?? 'Failed to save' }); }
    finally { setSaving(false); }
  }

  async function saveCompany() {
    setSavingCo(true); setCoMsg(null);
    try { await api.put('/carrier-portal/company', companyForm); setCoMsg({ type:'success', text:'Company details updated.' }); }
    catch(e:unknown) { setCoMsg({ type:'error', text:(e as {response?:{data?:{message?:string}}})?.response?.data?.message ?? 'Failed to save' }); }
    finally { setSavingCo(false); }
  }

  async function changePassword() {
    setPwMsg(null);
    if (!pwForm.currentPassword || !pwForm.newPassword) { setPwMsg({ type:'error', text:'All fields required.' }); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwMsg({ type:'error', text:'Passwords do not match.' }); return; }
    if (pwForm.newPassword.length < 8) { setPwMsg({ type:'error', text:'Min. 8 characters.' }); return; }
    setSavingPw(true);
    try { await api.put('/carrier-portal/me/password', { currentPassword:pwForm.currentPassword, newPassword:pwForm.newPassword }); setPwMsg({ type:'success', text:'Password changed.' }); setPwForm({ currentPassword:'', newPassword:'', confirmPassword:'' }); }
    catch(e:unknown) { setPwMsg({ type:'error', text:(e as {response?:{data?:{message?:string}}})?.response?.data?.message ?? 'Failed' }); }
    finally { setSavingPw(false); }
  }

  function toggleEquipment(eq:string) {
    setCompanyForm(f => ({
      ...f,
      equipmentTypes: f.equipmentTypes.includes(eq) ? f.equipmentTypes.filter(e => e !== eq) : [...f.equipmentTypes, eq],
    }));
  }

  const Alert = ({ m }: { m:Msg|null }) => m ? (
    <div style={{ marginBottom:12, padding:'8px 12px', background:m.type==='success'?'#f0fdf4':'#fee2e2', border:`1px solid ${m.type==='success'?'#86efac':'#fca5a5'}`, borderRadius:7, fontSize:13, color:m.type==='success'?'#15803d':'#dc2626' }}>{m.text}</div>
  ) : null;

  const initials = `${user?.firstName?.[0]??''}${user?.lastName?.[0]??''}`.toUpperCase();

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100%' }}>
      <CarrierTopbar title="Account Settings" subtitle="Profile & company details" />
      <div style={{ flex:1, overflowY:'auto', padding:'24px 28px' }}>
      <div style={{ maxWidth:720 }}>

        {/* Avatar */}
        <div style={{ display:'flex', alignItems:'center', gap:16, padding:'18px 20px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, marginBottom:20 }}>
          <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#f59e0b,#d97706)', display:'grid', placeItems:'center', fontSize:20, fontWeight:800, color:'#fff', flexShrink:0 }}>{initials}</div>
          <div>
            <div style={{ fontWeight:700, fontSize:16, color:'#0f172a' }}>{user?.firstName} {user?.lastName}</div>
            <div style={{ fontSize:13, color:'#64748b', marginTop:2 }}>{user?.email}</div>
            {carrier && <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{carrier.name} · MC# {carrier.mcNumber}</div>}
          </div>
          {carrier && (
            <div style={{ marginLeft:'auto', display:'flex', gap:8 }}>
              {carrier.w9OnFile && <span style={{ padding:'3px 10px', borderRadius:9999, fontSize:11, fontWeight:700, background:'#f0fdf4', color:'#15803d' }}>✓ W9 on file</span>}
              <span style={{ padding:'3px 10px', borderRadius:9999, fontSize:11, fontWeight:700, background: carrier.status==='ACTIVE'?'#f0fdf4':'#fee2e2', color:carrier.status==='ACTIVE'?'#15803d':'#dc2626' }}>{carrier.status}</span>
            </div>
          )}
        </div>

        {/* Personal info */}
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:24, marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:700, color:'#0f172a', margin:'0 0 18px' }}>Personal Information</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
            <Field label="First Name"><input style={inp} value={profileForm.firstName} onChange={e=>setProfileForm(f=>({...f,firstName:e.target.value}))} /></Field>
            <Field label="Last Name"><input style={inp} value={profileForm.lastName} onChange={e=>setProfileForm(f=>({...f,lastName:e.target.value}))} /></Field>
            <Field label="Email"><input style={readonlyInp} readOnly value={portalUser?.email??''} /></Field>
            <Field label="Phone"><input style={inp} value={profileForm.phone} onChange={e=>setProfileForm(f=>({...f,phone:e.target.value}))} placeholder="(555) 000-0000" /></Field>
          </div>
          <Alert m={msg} />
          <button onClick={saveProfile} disabled={saving} style={{ padding:'9px 22px', background:'#0f172a', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:saving?'not-allowed':'pointer', opacity:saving?0.7:1 }}>
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        </div>

        {/* Company details */}
        {carrier && (
          <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:24, marginBottom:20 }}>
            <h2 style={{ fontSize:15, fontWeight:700, color:'#0f172a', margin:'0 0 18px' }}>Company Details</h2>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
              <Field label="Company Name"><input style={readonlyInp} readOnly value={carrier.name} title="Contact your broker to update the company name" /></Field>
              <Field label="MC Number"><input style={readonlyInp} readOnly value={carrier.mcNumber} /></Field>
              <Field label="DOT Number"><input style={inp} value={companyForm.dotNumber} onChange={e=>setCompanyForm(f=>({...f,dotNumber:e.target.value}))} placeholder="DOT12345" /></Field>
              <Field label="Contact Person"><input style={inp} value={companyForm.contactPerson} onChange={e=>setCompanyForm(f=>({...f,contactPerson:e.target.value}))} /></Field>
              <Field label="Company Phone"><input style={inp} value={companyForm.phone} onChange={e=>setCompanyForm(f=>({...f,phone:e.target.value}))} /></Field>
              <Field label="Company Email"><input style={inp} value={companyForm.email} onChange={e=>setCompanyForm(f=>({...f,email:e.target.value}))} /></Field>
              <Field label="Address"><input style={inp} value={companyForm.address} onChange={e=>setCompanyForm(f=>({...f,address:e.target.value}))} /></Field>
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr', gap:8 }}>
                <Field label="City"><input style={inp} value={companyForm.city} onChange={e=>setCompanyForm(f=>({...f,city:e.target.value}))} /></Field>
                <Field label="State"><input style={inp} value={companyForm.state} onChange={e=>setCompanyForm(f=>({...f,state:e.target.value}))} /></Field>
                <Field label="Zip"><input style={inp} value={companyForm.zipCode} onChange={e=>setCompanyForm(f=>({...f,zipCode:e.target.value}))} /></Field>
              </div>
            </div>

            {/* Equipment types */}
            <div style={{ marginBottom:14 }}>
              <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:8, textTransform:'uppercase' }}>Equipment Types</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {EQUIPMENT_TYPES.map(eq => (
                  <button key={eq} onClick={()=>toggleEquipment(eq)} style={{ padding:'5px 12px', borderRadius:9999, fontSize:11, fontWeight:600, cursor:'pointer', border:`1px solid ${companyForm.equipmentTypes.includes(eq)?'#3b82f6':'#e2e8f0'}`, background:companyForm.equipmentTypes.includes(eq)?'#eff6ff':'#fff', color:companyForm.equipmentTypes.includes(eq)?'#1d4ed8':'#475569', transition:'all 0.15s' }}>
                    {companyForm.equipmentTypes.includes(eq) && '✓ '}{eq}
                  </button>
                ))}
              </div>
            </div>

            {carrier.insuranceExpiry && (
              <div style={{ marginBottom:14, padding:'10px 14px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, fontSize:12 }}>
                ⚠️ Insurance expiry: <strong>{new Date(carrier.insuranceExpiry).toLocaleDateString()}</strong>
                {new Date(carrier.insuranceExpiry) < new Date() && ' — EXPIRED'}
              </div>
            )}

            <Alert m={coMsg} />
            <button onClick={saveCompany} disabled={savingCo} style={{ padding:'9px 22px', background:'#0f172a', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:savingCo?'not-allowed':'pointer', opacity:savingCo?0.7:1 }}>
              {savingCo ? 'Saving…' : 'Save Company Details'}
            </button>
          </div>
        )}

        {/* Password */}
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:24 }}>
          <h2 style={{ fontSize:15, fontWeight:700, color:'#0f172a', margin:'0 0 18px' }}>Change Password</h2>
          <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:14 }}>
            <Field label="Current Password"><input type="password" style={inp} value={pwForm.currentPassword} onChange={e=>setPwForm(f=>({...f,currentPassword:e.target.value}))} placeholder="••••••••" /></Field>
            <Field label="New Password"><input type="password" style={inp} value={pwForm.newPassword} onChange={e=>setPwForm(f=>({...f,newPassword:e.target.value}))} placeholder="Min. 8 characters" /></Field>
            <Field label="Confirm New Password"><input type="password" style={inp} value={pwForm.confirmPassword} onChange={e=>setPwForm(f=>({...f,confirmPassword:e.target.value}))} placeholder="Re-enter new password" /></Field>
          </div>
          <Alert m={pwMsg} />
          <button onClick={changePassword} disabled={savingPw} style={{ padding:'9px 22px', background:'#dc2626', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:savingPw?'not-allowed':'pointer', opacity:savingPw?0.7:1 }}>
            {savingPw ? 'Updating…' : 'Update Password'}
          </button>
        </div>

      </div>
      </div>
    </div>
  );
}

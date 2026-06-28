'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/auth.store';
import api from '@/lib/api';

interface PortalUser { id:string; firstName:string; lastName:string; email:string; phone:string|null; }
interface PortalCustomer { id:string; name:string; email:string|null; phone:string|null; address:string|null; city:string|null; state:string|null; zipCode:string|null; creditTerms:number; }

type Msg = { type:'success'|'error'; text:string };

function Field({ label, children }: { label:string; children:React.ReactNode }) {
  return (
    <div>
      <label style={{ display:'block', fontSize:11, fontWeight:700, color:'#374151', marginBottom:5, textTransform:'uppercase', letterSpacing:'0.3px' }}>{label}</label>
      {children}
    </div>
  );
}
const inp: React.CSSProperties = { width:'100%', height:38, padding:'0 12px', border:'1px solid #e2e8f0', borderRadius:8, fontSize:13, color:'#0f172a', background:'#fafafa', boxSizing:'border-box', outline:'none' };
const readonlyInp: React.CSSProperties = { ...inp, background:'#f1f5f9', color:'#94a3b8', cursor:'not-allowed' };

export default function SettingsPage() {
  const { user } = useAuthStore();
  const [portalUser, setPortalUser]         = useState<PortalUser|null>(null);
  const [company, setCompany]               = useState<PortalCustomer|null>(null);
  const [profileForm, setProfileForm]       = useState({ firstName:'', lastName:'', phone:'' });
  const [pwForm, setPwForm]                 = useState({ currentPassword:'', newPassword:'', confirmPassword:'' });
  const [saving, setSaving]                 = useState(false);
  const [savingPw, setSavingPw]             = useState(false);
  const [msg, setMsg]                       = useState<Msg|null>(null);
  const [pwMsg, setPwMsg]                   = useState<Msg|null>(null);

  useEffect(() => {
    api.get('/portal/me').then(r => {
      setPortalUser(r.data.user);
      setCompany(r.data.customer);
      setProfileForm({ firstName:r.data.user?.firstName??'', lastName:r.data.user?.lastName??'', phone:r.data.user?.phone??'' });
    });
  }, []);

  async function saveProfile() {
    setSaving(true); setMsg(null);
    try {
      await api.put('/portal/me', profileForm);
      setMsg({ type:'success', text:'Profile updated successfully.' });
    } catch(e:unknown) {
      setMsg({ type:'error', text:(e as {response?:{data?:{message?:string}}})?.response?.data?.message ?? 'Failed to save' });
    } finally { setSaving(false); }
  }

  async function changePassword() {
    setPwMsg(null);
    if (!pwForm.currentPassword || !pwForm.newPassword) { setPwMsg({ type:'error', text:'All password fields are required.' }); return; }
    if (pwForm.newPassword !== pwForm.confirmPassword) { setPwMsg({ type:'error', text:'New passwords do not match.' }); return; }
    if (pwForm.newPassword.length < 8) { setPwMsg({ type:'error', text:'Password must be at least 8 characters.' }); return; }
    setSavingPw(true);
    try {
      await api.put('/portal/me/password', { currentPassword:pwForm.currentPassword, newPassword:pwForm.newPassword });
      setPwMsg({ type:'success', text:'Password changed successfully.' });
      setPwForm({ currentPassword:'', newPassword:'', confirmPassword:'' });
    } catch(e:unknown) {
      setPwMsg({ type:'error', text:(e as {response?:{data?:{message?:string}}})?.response?.data?.message ?? 'Failed to change password' });
    } finally { setSavingPw(false); }
  }

  const initials = `${user?.firstName?.[0]??''}${user?.lastName?.[0]??''}`.toUpperCase();

  return (
    <div style={{ maxWidth:680 }}>
      <div style={{ marginBottom:26 }}>
        <h1 style={{ fontSize:22, fontWeight:800, color:'#0f172a', margin:0 }}>⚙️ Account Settings</h1>
        <p style={{ color:'#64748b', fontSize:13, marginTop:4 }}>Manage your profile and security settings</p>
      </div>

      {/* Avatar */}
      <div style={{ display:'flex', alignItems:'center', gap:16, padding:'18px 20px', background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, marginBottom:20 }}>
        <div style={{ width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#3b82f6,#1d4ed8)', display:'grid', placeItems:'center', fontSize:20, fontWeight:800, color:'#fff', flexShrink:0 }}>{initials}</div>
        <div>
          <div style={{ fontWeight:700, fontSize:16, color:'#0f172a' }}>{user?.firstName} {user?.lastName}</div>
          <div style={{ fontSize:13, color:'#64748b', marginTop:2 }}>{user?.email}</div>
          {company && <div style={{ fontSize:12, color:'#94a3b8', marginTop:2 }}>{company.name}</div>}
        </div>
      </div>

      {/* Profile */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:24, marginBottom:20 }}>
        <h2 style={{ fontSize:15, fontWeight:700, color:'#0f172a', margin:'0 0 18px' }}>Personal Information</h2>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14, marginBottom:14 }}>
          <Field label="First Name">
            <input style={inp} value={profileForm.firstName} onChange={e=>setProfileForm(f=>({...f,firstName:e.target.value}))} />
          </Field>
          <Field label="Last Name">
            <input style={inp} value={profileForm.lastName} onChange={e=>setProfileForm(f=>({...f,lastName:e.target.value}))} />
          </Field>
          <Field label="Email (login)">
            <input style={readonlyInp} readOnly value={portalUser?.email??''} title="Contact support to change your email" />
          </Field>
          <Field label="Phone">
            <input style={inp} value={profileForm.phone} onChange={e=>setProfileForm(f=>({...f,phone:e.target.value}))} placeholder="(555) 000-0000" />
          </Field>
        </div>
        {msg && <div style={{ marginBottom:12, padding:'8px 12px', background:msg.type==='success'?'#f0fdf4':'#fee2e2', border:`1px solid ${msg.type==='success'?'#86efac':'#fca5a5'}`, borderRadius:7, fontSize:13, color:msg.type==='success'?'#15803d':'#dc2626' }}>{msg.text}</div>}
        <button onClick={saveProfile} disabled={saving} style={{ padding:'9px 22px', background:'#0f172a', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:saving?'not-allowed':'pointer', opacity:saving?0.7:1 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>

      {/* Company info (read-only) */}
      {company && (
        <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:24, marginBottom:20 }}>
          <h2 style={{ fontSize:15, fontWeight:700, color:'#0f172a', margin:'0 0 18px' }}>Company Information</h2>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
            <Field label="Company Name"><input style={readonlyInp} readOnly value={company.name} /></Field>
            <Field label="Company Email"><input style={readonlyInp} readOnly value={company.email??''} /></Field>
            <Field label="Phone"><input style={readonlyInp} readOnly value={company.phone??''} /></Field>
            <Field label="Credit Terms"><input style={readonlyInp} readOnly value={`Net ${company.creditTerms}`} /></Field>
            {company.address && <div style={{ gridColumn:'1/-1' }}><Field label="Address"><input style={readonlyInp} readOnly value={`${company.address}${company.city?`, ${company.city}`:''}${company.state?`, ${company.state}`:''}${company.zipCode?` ${company.zipCode}`:''}`} /></Field></div>}
          </div>
          <p style={{ margin:'12px 0 0', fontSize:11, color:'#94a3b8' }}>To update company details, contact your account representative.</p>
        </div>
      )}

      {/* Password */}
      <div style={{ background:'#fff', border:'1px solid #e2e8f0', borderRadius:12, padding:24 }}>
        <h2 style={{ fontSize:15, fontWeight:700, color:'#0f172a', margin:'0 0 18px' }}>Change Password</h2>
        <div style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:14 }}>
          <Field label="Current Password">
            <input type="password" style={inp} value={pwForm.currentPassword} onChange={e=>setPwForm(f=>({...f,currentPassword:e.target.value}))} placeholder="••••••••" />
          </Field>
          <Field label="New Password">
            <input type="password" style={inp} value={pwForm.newPassword} onChange={e=>setPwForm(f=>({...f,newPassword:e.target.value}))} placeholder="Min. 8 characters" />
          </Field>
          <Field label="Confirm New Password">
            <input type="password" style={inp} value={pwForm.confirmPassword} onChange={e=>setPwForm(f=>({...f,confirmPassword:e.target.value}))} placeholder="Re-enter new password" />
          </Field>
        </div>
        {pwMsg && <div style={{ marginBottom:12, padding:'8px 12px', background:pwMsg.type==='success'?'#f0fdf4':'#fee2e2', border:`1px solid ${pwMsg.type==='success'?'#86efac':'#fca5a5'}`, borderRadius:7, fontSize:13, color:pwMsg.type==='success'?'#15803d':'#dc2626' }}>{pwMsg.text}</div>}
        <button onClick={changePassword} disabled={savingPw} style={{ padding:'9px 22px', background:'#dc2626', color:'#fff', border:'none', borderRadius:8, fontSize:13, fontWeight:700, cursor:savingPw?'not-allowed':'pointer', opacity:savingPw?0.7:1 }}>
          {savingPw ? 'Updating…' : 'Update Password'}
        </button>
      </div>
    </div>
  );
}

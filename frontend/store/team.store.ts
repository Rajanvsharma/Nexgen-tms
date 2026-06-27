'use client';

import { create } from 'zustand';
import api from '@/lib/api';
import { toast } from '@/store/toast.store';

export interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  role: string;
  isActive: boolean;
}

export interface Team {
  id: string;
  name: string;
  isActive: boolean;
  repVisibility: 'own' | 'team';
  manager: { id: string; firstName: string; lastName: string } | null;
  _count: { members: number };
}

export interface TeamDetail extends Team {
  members: TeamMember[];
}

interface TeamStore {
  teams: Team[];
  selectedTeam: TeamDetail | null;
  loading: boolean;
  saving: boolean;
  fetchTeams: () => Promise<void>;
  fetchTeamDetail: (id: string) => Promise<void>;
  createTeam: (name: string, managerId?: string) => Promise<void>;
  updateTeam: (id: string, data: Partial<{ name: string; managerId: string | null }>) => Promise<void>;
  setRepVisibility: (id: string, value: 'own' | 'team') => Promise<void>;
  addMembers: (teamId: string, userIds: string[]) => Promise<void>;
  removeMember: (teamId: string, userId: string) => Promise<void>;
  deactivateTeam: (id: string) => Promise<void>;
}

export const useTeamStore = create<TeamStore>((set, get) => ({
  teams: [],
  selectedTeam: null,
  loading: false,
  saving: false,

  async fetchTeams() {
    set({ loading: true });
    try {
      const { data } = await api.get('/teams');
      set({ teams: data });
    } catch {
      toast.error('Failed to load teams');
    } finally {
      set({ loading: false });
    }
  },

  async fetchTeamDetail(id) {
    try {
      const { data } = await api.get(`/teams/${id}`);
      set({ selectedTeam: data });
    } catch {
      toast.error('Failed to load team detail');
    }
  },

  async createTeam(name, managerId) {
    set({ saving: true });
    try {
      const { data } = await api.post('/teams', { name, managerId: managerId || null });
      set(s => ({ teams: [...s.teams, data] }));
      toast.success('Team created');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to create team');
    } finally {
      set({ saving: false });
    }
  },

  async updateTeam(id, data) {
    set({ saving: true });
    try {
      const { data: updated } = await api.put(`/teams/${id}`, data);
      set(s => ({ teams: s.teams.map(t => t.id === id ? { ...t, ...updated } : t) }));
      toast.success('Team updated');
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || 'Failed to update team');
    } finally {
      set({ saving: false });
    }
  },

  async setRepVisibility(id, value) {
    try {
      const { data: updated } = await api.patch(`/teams/${id}/visibility`, { repVisibility: value });
      set(s => ({ teams: s.teams.map(t => t.id === id ? { ...t, repVisibility: updated.repVisibility } : t) }));
      toast.success(`Visibility set to "${value === 'own' ? 'Own loads only' : 'Full team loads'}"`);
    } catch {
      toast.error('Failed to update visibility');
    }
  },

  async addMembers(teamId, userIds) {
    set({ saving: true });
    try {
      await Promise.all(userIds.map(userId => api.post(`/teams/${teamId}/members`, { userId })));
      await get().fetchTeams();
      toast.success(`${userIds.length} member${userIds.length !== 1 ? 's' : ''} added`);
    } catch {
      toast.error('Failed to add member');
    } finally {
      set({ saving: false });
    }
  },

  async removeMember(teamId, userId) {
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`);
      set(s => ({
        selectedTeam: s.selectedTeam?.id === teamId
          ? { ...s.selectedTeam, members: s.selectedTeam.members.filter(m => m.id !== userId) }
          : s.selectedTeam,
        teams: s.teams.map(t => t.id === teamId ? { ...t, _count: { members: t._count.members - 1 } } : t),
      }));
      toast.success('Member removed');
    } catch {
      toast.error('Failed to remove member');
    }
  },

  async deactivateTeam(id) {
    try {
      await api.put(`/teams/${id}`, { isActive: false });
      set(s => ({ teams: s.teams.map(t => t.id === id ? { ...t, isActive: false } : t) }));
      toast.success('Team deactivated');
    } catch {
      toast.error('Failed to deactivate team');
    }
  },
}));

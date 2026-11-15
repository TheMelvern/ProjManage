import axiosInstance from '../api/axiosConfig';

const liveApiEnabled = import.meta.env.VITE_USE_LIVE_API === 'true';

const toLegacyProject = (project) => ({
  ...project,
  role: 'Project Member',
  progress: project.progress ?? 0,
  health: String(project.health || 'UNKNOWN').toLowerCase().replace('amber', 'at-risk'),
  status: String(project.status || 'PLANNING').toLowerCase().replace(/_/g, '-'),
  timeline: project.targetEndDate || '',
  category: project.category || 'Implementation'
});

export const projectService = {
  async getProjects() {
    if (liveApiEnabled) {
      const response = await axiosInstance.get('/projects');
      return { success: true, data: response.data.data.map(toLegacyProject) };
    }
    return {
      success: true,
      data: [
        {
          id: 1,
          name: 'Enterprise CRM Overhaul',
          role: 'Lead PM',
          client: 'Nexus Systems',
          progress: 78,
          health: 'good',
          healthColor: 'emerald',
          timeline: 'Mar 24, 2024',
          icon: 'rocket_launch',
          iconColor: 'text-emerald-600',
          iconBg: 'bg-emerald-50 dark:bg-emerald-900/20',
          status: 'active',
          priority: 'high',
          category: 'Digital Transformation'
        },
        {
          id: 2,
          name: 'Q4 Supply Chain Optimization',
          role: 'Strategic Lead',
          client: 'Logistics Inc.',
          progress: 32,
          health: 'at-risk',
          healthColor: 'rose',
          issue: 'Resource Gap',
          timeline: 'Feb 28, 2024',
          icon: 'warning',
          iconColor: 'text-rose-600',
          iconBg: 'bg-rose-100 dark:bg-rose-900/40',
          status: 'at-risk',
          priority: 'critical',
          category: 'Operations'
        }
      ]
    }
  },
  
  async createProject(data) {
    if (liveApiEnabled) {
      const response = await axiosInstance.post('/projects', {
        name: data.name, description: data.description || undefined,
        client: data.client || undefined
      });
      return { success: true, data: toLegacyProject(response.data.data) };
    }
    console.log('Creating project:', data)
    return { success: true, data }
  },
  
  async updateProject(id, data) {
    if (liveApiEnabled) {
      const payload = Object.fromEntries(
        ['name', 'description', 'client', 'status', 'health']
          .filter((key) => data[key] !== undefined)
          .map((key) => [key, data[key]])
      );
      if (payload.status) payload.status = payload.status.toUpperCase().replace(/-/g, '_');
      if (payload.health) payload.health = payload.health.toUpperCase().replace('AT-RISK', 'AMBER');
      const response = await axiosInstance.patch('/projects/' + encodeURIComponent(id), payload);
      return { success: true, data: toLegacyProject(response.data.data) };
    }
    console.log('Updating project:', id, data)
    return { success: true, data }
  },
  
  async resolveIssue(projectId) {
    if (liveApiEnabled) {
      throw new Error('Issue resolution API is not implemented yet');
    }
    console.log('Resolving issue for project:', projectId)
    return { success: true }
  }
}
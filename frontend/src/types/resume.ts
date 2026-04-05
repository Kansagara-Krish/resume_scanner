export interface Resume {
  id: string;
  name: string;
  score?: number;
  status: 'pending' | 'completed' | 'failed';
  uploadedAt: string;
}

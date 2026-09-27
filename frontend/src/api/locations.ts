import { api } from './client';

export interface LocationDetail {
  atm_id: string;
  bank_id: string;
  location: { lat: number; lng: number };
  state: string;
  district: string;
  active: boolean;
  historical_fraud_linked_withdrawals: number;
}

export const locationsApi = {
  getLocation: (atmId: string) => api.get<LocationDetail>(`/locations/${atmId}`),
};

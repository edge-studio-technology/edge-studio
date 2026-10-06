export type AddressBookEntry = {
  id: string;
  label: string;
  address: string;
  notes: string | null;
  created_at: string;
  isLocalDevice: boolean;
};

export type CreateAddressBookEntryInput = {
  label: string;
  address: string;
  notes?: string | null;
};

export type UpdateAddressBookEntryInput = {
  label?: string;
  address?: string;
  notes?: string | null;
};

export interface Field {
  key: string;
  label: string;
  type?: "textarea" | "date" | "number" | "email";
  required?: boolean;
}
export interface Resource {
  key: string;
  label: string;
  singular: string;
  description: string;
  states: readonly string[];
  fields: readonly Field[];
  parent?: string;
}

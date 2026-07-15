import { createClient } from '@supabase/supabase-js';

const url = 'http://100.67.107.59:54321';
const key = 'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

const supabase = createClient(url, key);

try {
  const { data: employees, error } = await supabase
    .from('employees')
    .select('id, name, pin_code, business_id');

  if (error) {
    console.error("Error:", error);
  } else {
    console.log("Employees found in db:", employees);
  }
} catch (err) {
  console.error("Crash:", err);
}

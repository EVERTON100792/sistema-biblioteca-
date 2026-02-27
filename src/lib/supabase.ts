import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rfgltdewdhbdijsrvwde.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJmZ2x0ZGV3ZGhiZGlqc3J2d2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxNjE4NjUsImV4cCI6MjA4NzczNzg2NX0.d_Qp0yV_xPb930vxuElVQpI7aKiEkOAKoIHYqPysrDA';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

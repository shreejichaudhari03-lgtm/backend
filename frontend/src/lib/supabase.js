import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://spcqirimvqxgeyocysnt.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNwY3FpcmltdnF4Z2V5b2N5c250Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIxODgwMTUsImV4cCI6MjA4Nzc2NDAxNX0.929QFIRzGl8yJw-O55XCatUXniPA5rswpSW1yCGN23s';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// JuvinalPay Unified Configuration
const supabaseUrl = 'https://losdziwmoxmdjaboggea.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxvc2R6aXdtb3htZGphYm9nZ2VhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njc0NTc5NzIsImV4cCI6MjA4MzAzMzk3Mn0.2ijy4sofyqtTfuAIG3-0ZxrMQ6KNsQQeCjSAHy4gIRI';

if (!window.supabaseClient) {
    window.supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);
    console.log("✅ JuvinalPay: Supabase Engine Initialized");
}
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateUserRole() {
  // Get all users
  const { data: users, error } = await supabase
    .from('users')
    .select('*');

  if (error) {
    console.error('Error fetching users:', error);
    return;
  }

  if (!users || users.length === 0) {
    console.log('No users found');
    return;
  }

  console.log('Current users:');
  users.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email} - Role: ${user.role}`);
  });

  // Update the first user to PI role
  const userToUpdate = users[0];
  console.log(`\nUpdating ${userToUpdate.email} to PI role...`);

  const { error: updateError } = await supabase
    .from('users')
    .update({ role: 'pi' })
    .eq('id', userToUpdate.id);

  if (updateError) {
    console.error('Error updating user:', updateError);
  } else {
    console.log('✓ User role updated to PI!');
    console.log('\nNow refresh your browser at http://localhost:3003');
    console.log('You should see the "Upload New Protocol" button!');
  }
}

updateUserRole();

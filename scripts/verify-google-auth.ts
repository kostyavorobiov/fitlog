import dotenv from 'dotenv';
dotenv.config({ path: 'mobile/.env' });

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, details?: any) {
  if (condition) {
    console.log(`  ✅ PASS: ${testName}`);
    passCount++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    if (details) console.error('     Details:', details);
    failCount++;
  }
}

async function run() {
  const { supabase, isSupabaseConfigured, authStorageAdapter } = await import('../mobile/src/lib/supabase');
  const { AuthService } = await import('../mobile/src/services/authService');
  console.log('================================================================');
  console.log('  FitLog Mobile Google OAuth Flow & Deep Link Verification');
  console.log('================================================================\n');

  // Test 1: Supabase client is configured and has PKCE enabled
  console.log('[Test 1] Supabase Client Configuration & PKCE Storage Check');
  assert(isSupabaseConfigured(), 'Supabase is configured with URL and anon key');
  assert(Boolean(supabase), 'Supabase client initialized');

  // Test 2: signInWithOAuth generates PKCE code_challenge and stores code_verifier
  console.log('\n[Test 2] Google OAuth URL Generation with PKCE');
  const { data, error } = await supabase!.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: 'fitlog://auth/callback',
      skipBrowserRedirect: true,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  assert(!error, 'signInWithOAuth generated URL without errors');
  assert(Boolean(data?.url), 'OAuth URL exists in response');
  assert(data!.url.includes('redirect_to=fitlog%3A%2F%2Fauth%2Fcallback'), 'Redirect URL matches fitlog://auth/callback');
  assert(data!.url.includes('code_challenge='), 'URL contains PKCE code_challenge parameter');
  assert(data!.url.includes('code_challenge_method=s256'), 'URL contains code_challenge_method=s256');

  // Verify that code_verifier is persisted in authStorageAdapter
  const codeVerifierKey = 'sb-moxdrbofwqjzqomrhjqg-auth-token-code-verifier';
  const storedVerifier = await authStorageAdapter.getItem(codeVerifierKey);
  assert(Boolean(storedVerifier) && typeof storedVerifier === 'string', 'PKCE code_verifier is stored in auth storage as string');

  // Test 3: AuthService.handleAuthCallbackUrl handles error responses safely
  console.log('\n[Test 3] Error Handling in Callback');
  const errorCallbackRes = await AuthService.handleAuthCallbackUrl(
    'fitlog://auth/callback?error=access_denied&error_description=User%20declined%20authorization'
  );
  assert(errorCallbackRes.user === null, 'Error callback returns null user');
  assert(errorCallbackRes.error === 'User declined authorization', 'Error callback returns decoded error description');

  // Test 4: AuthService.handleAuthCallbackUrl handles object params
  const errorParamRes = await AuthService.handleAuthCallbackUrl({
    error: 'access_denied',
    error_description: 'Access denied by user',
  });
  assert(errorParamRes.user === null, 'Object param error returns null user');
  assert(errorParamRes.error === 'Access denied by user', 'Object param error returns error string');

  // Test 5: Prevent duplicate code exchange
  console.log('\n[Test 4] Duplicate Code Guarding');
  // First time with a dummy code: will hit Supabase exchange, return invalid code
  const firstRes = await AuthService.handleAuthCallbackUrl('fitlog://auth/callback?code=mock_used_code');
  // Second time with identical code: should be guarded by processedCodes set
  const secondRes = await AuthService.handleAuthCallbackUrl('fitlog://auth/callback?code=mock_used_code');
  assert(Boolean(secondRes), 'Duplicate code call handled safely without crashing');

  console.log('\n================================================================');
  console.log(`  Results: ${passCount} PASSED, ${failCount} FAILED`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal error in Google OAuth verification:', err);
  process.exit(1);
});

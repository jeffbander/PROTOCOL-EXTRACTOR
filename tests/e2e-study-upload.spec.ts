import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Complete Study Upload Flow (E2E)', () => {
  test('should upload and extract study from PDF', async ({ page }) => {
    console.log('\n=== Starting E2E Test ===\n');

    // Step 1: Navigate to upload page
    console.log('1. Navigating to upload page...');
    await page.goto('/studies/upload');

    // Check if redirected to login
    const url = page.url();
    if (url.includes('/auth/login')) {
      console.log('⚠ Not logged in, redirected to login page');
      console.log('\nTo complete this test:');
      console.log('1. Manually log in as a PI user at http://localhost:3003');
      console.log('2. Then run this test again');
      console.log('\nAlternatively, create a new account:');
      console.log('- Go to http://localhost:3003/auth/login');
      console.log('- Enter your email');
      console.log('- Enter your name');
      console.log('- Select "Principal Investigator (PI)"');
      console.log('- Click "Send magic link"');
      console.log('- Check email and click the link');
      test.skip(true, 'User not logged in');
      return;
    }

    console.log('✓ On upload page');

    // Step 2: Verify upload form exists
    await expect(page.getByText('Upload Protocol')).toBeVisible();
    await expect(page.getByText('Protocol PDF (max 50MB)')).toBeVisible();
    console.log('✓ Upload form is visible');

    // Step 3: Create a mock PDF file
    console.log('\n2. Creating mock PDF file...');
    const mockPDFContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj

2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj

3 0 obj
<<
/Type /Page
/Parent 2 0 R
/Contents 4 0 R
/MediaBox [0 0 612 792]
>>
endobj

4 0 obj
<<
/Length 100
>>
stream
BT
/F1 12 Tf
50 700 Td
(Clinical Trial Protocol - Phase 2 Study) Tj
0 -20 Td
(Indication: Type 2 Diabetes) Tj
0 -20 Td
(Target Enrollment: 100 patients) Tj
ET
endstream
endobj

xref
0 5
0000000000 65535 f
0000000015 00000 n
0000000074 00000 n
0000000131 00000 n
0000000229 00000 n
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
379
%%EOF`;

    const testPDFPath = path.join(process.cwd(), 'test-protocol.pdf');
    fs.writeFileSync(testPDFPath, mockPDFContent);
    console.log('✓ Mock PDF created at:', testPDFPath);

    // Step 4: Upload the file
    console.log('\n3. Uploading PDF file...');
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles(testPDFPath);
    console.log('✓ File selected');

    // Verify file is selected
    const fileName = await page.locator('text=/Selected:.*test-protocol.pdf/').textContent();
    expect(fileName).toContain('test-protocol.pdf');
    console.log('✓ File selection confirmed:', fileName);

    // Step 5: Click extract button
    console.log('\n4. Extracting protocol data...');
    const extractButton = page.getByRole('button', { name: /Extract Protocol Data/i });
    await extractButton.click();
    console.log('✓ Extract button clicked');

    // Wait for extraction to complete (this calls Claude API)
    console.log('⏳ Waiting for Claude AI extraction (this may take 10-30 seconds)...');

    // Wait for either success or error
    try {
      // Wait for the "Review Extracted Data" heading to appear
      await page.waitForSelector('text=/Review Extracted Data/i', { timeout: 60000 });
      console.log('✓ Extraction completed!');

      // Step 6: Verify extracted data is shown
      console.log('\n5. Verifying extracted data...');

      // Check for study name field
      const studyNameInput = page.getByLabel('Study Name');
      const studyName = await studyNameInput.inputValue();
      console.log('  Study Name:', studyName);

      // Check for phase field
      const phaseInput = page.getByLabel('Phase');
      const phase = await phaseInput.inputValue();
      console.log('  Phase:', phase);

      // Check for target enrollment
      const enrollmentInput = page.getByLabel('Target Enrollment');
      const enrollment = await enrollmentInput.inputValue();
      console.log('  Target Enrollment:', enrollment);

      // Check for indication
      const indicationInput = page.getByLabel('Indication');
      const indication = await indicationInput.inputValue();
      console.log('  Indication:', indication);

      console.log('\n✓ All extracted fields are visible');

      // Step 7: Submit to create study
      console.log('\n6. Creating study...');
      const createButton = page.getByRole('button', { name: /Confirm & Create Study/i });
      await createButton.click();
      console.log('✓ Create button clicked');

      // Wait for redirect to study detail page
      await page.waitForURL(/\/studies\/[a-f0-9-]+$/i, { timeout: 10000 });
      console.log('✓ Redirected to study detail page');

      // Verify we're on the study detail page
      const finalUrl = page.url();
      console.log('  Final URL:', finalUrl);

      await expect(page.getByText('Overview')).toBeVisible();
      await expect(page.getByText('Team')).toBeVisible();
      await expect(page.getByText('Patients')).toBeVisible();
      console.log('✓ Study tabs are visible');

      console.log('\n=== ✓ E2E Test Completed Successfully! ===\n');
      console.log('Results:');
      console.log('  ✓ PDF uploaded');
      console.log('  ✓ Claude extracted data');
      console.log('  ✓ Study created');
      console.log('  ✓ Redirected to study detail page');

    } catch (error) {
      // Check for error message
      const errorText = await page.locator('.bg-red-50').textContent().catch(() => null);
      if (errorText) {
        console.error('\n❌ Extraction failed with error:', errorText);
      } else {
        console.error('\n❌ Test failed:', error);
      }
      throw error;
    } finally {
      // Cleanup: delete test PDF
      if (fs.existsSync(testPDFPath)) {
        fs.unlinkSync(testPDFPath);
        console.log('\n🧹 Cleaned up test PDF file');
      }
    }
  });
});

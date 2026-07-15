# Required Action: Run KDS Fixes Script

To verify all the fixes (Prep Duration, Refund Status, and Cancel Order), you **MUST** run the updated SQL script in your Supabase Dashboard.

This single script fixes:
1.  **Prep Time**: Ensures "Empty" duration is calculated correctly for older orders.
2.  **Refund Status**: Adds necessary columns to display "Refunded" badges.
3.  **Cancel Order**: Creates a secure function to allow deleting/cancelling orders without permission errors.

### Instructions:

1.  Open **Supabase Dashboard** -> **SQL Editor**.
2.  Create a **New Query**.
3.  Copy and Paste the content of the file: `setup_kds_fixes.sql` (located in your project root).
    *   *Note: This file replaces the previous `create_history_rpc.sql`.*
4.  Click **Run**.
5.  Refresh your application.

> **Why?** The application needs these database functions to safely access history data and perform deletions that might be restricted by standard security rules.

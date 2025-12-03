#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

/**
 * Check if cursor rules are in sync with Claude agents
 * This script is used both in CI and can be run locally
 */

function main() {
  console.log('🔍 Checking if Cursor rules are in sync with Claude agents...\n');

  try {
    // Check if cursor/rules directory exists
    const cursorRulesDir = path.join(__dirname, '../cursor/rules');
    if (!fs.existsSync(cursorRulesDir)) {
      console.log('📁 Creating cursor/rules directory...');
      fs.mkdirSync(cursorRulesDir, { recursive: true });
    }

    // Get initial git status
    let initialStatus;
    try {
      initialStatus = execSync('git status --porcelain cursor/rules/', { encoding: 'utf8' });
    } catch (error) {
      console.log('⚠️  Warning: Unable to check git status. Proceeding with sync check...');
      initialStatus = '';
    }

    // Count Claude agents
    const claudeAgentsDir = path.join(__dirname, '../claude/agents');
    const claudeAgents = fs.readdirSync(claudeAgentsDir)
      .filter(file => file.startsWith('hcc-frontend-') && file.endsWith('.md'));

    console.log(`📊 Found ${claudeAgents.length} Claude agents`);

    // Remove existing cursor rules
    console.log('🗑️  Removing existing cursor rules...');
    const existingMdcFiles = fs.readdirSync(cursorRulesDir)
      .filter(file => file.endsWith('.mdc'));

    existingMdcFiles.forEach(file => {
      fs.unlinkSync(path.join(cursorRulesDir, file));
    });

    // Regenerate cursor rules
    console.log('🔄 Regenerating cursor rules from Claude agents...');
    try {
      execSync('npm run convert-cursor', {
        stdio: 'inherit',
        cwd: path.join(__dirname, '..')
      });
    } catch (error) {
      console.error('❌ Failed to run conversion script:', error.message);
      process.exit(1);
    }

    // Count generated cursor rules
    const cursorRules = fs.readdirSync(cursorRulesDir)
      .filter(file => file.endsWith('.mdc'));

    console.log(`📊 Generated ${cursorRules.length} cursor rules`);

    // Check if counts match
    if (claudeAgents.length !== cursorRules.length) {
      console.error(`❌ Agent count mismatch!`);
      console.error(`   Claude agents: ${claudeAgents.length}`);
      console.error(`   Cursor rules: ${cursorRules.length}`);
      process.exit(1);
    }

    // Check for git changes
    let finalStatus;
    try {
      finalStatus = execSync('git status --porcelain cursor/rules/', { encoding: 'utf8' });
    } catch (error) {
      console.log('⚠️  Warning: Unable to check final git status.');
      console.log('✅ Conversion completed successfully');
      return;
    }

    if (finalStatus.trim()) {
      console.error('\n❌ Cursor rules are out of sync with Claude agents!');
      console.error('\nThe following files have changes:');
      console.error(finalStatus);

      console.error('\n📋 To fix this:');
      console.error('  1. Run: npm run convert-cursor');
      console.error('  2. Commit the updated cursor/*.mdc files');
      console.error('  3. Push your changes');

      try {
        const diff = execSync('git diff cursor/rules/', { encoding: 'utf8' });
        if (diff.trim()) {
          console.error('\n🔍 Detailed diff:');
          console.error(diff);
        }
      } catch (error) {
        // Diff failed, but we already know there are changes
      }

      process.exit(1);
    }

    console.log('\n✅ Cursor rules are in sync with Claude agents!');
    console.log(`📊 Successfully verified ${cursorRules.length} cursor rules`);

  } catch (error) {
    console.error('❌ Sync check failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main };
"use client";

import { useState, useCallback, DragEvent } from "react";
import { Athlete } from "../types";

interface CsvImportProps {
  onImportComplete: (athletes: Athlete[]) => void;
  teamId?: string;
}

interface CsvRow {
  [key: string]: string;
}

interface ColumnMapping {
  csvColumn: string;
  athleteField: keyof Athlete;
  required: boolean;
}

const CSV_TEMPLATE = `name,age,gender,group,xp,streak,weightStreak,totalPractices
John Doe,14,M,platinum,250,7,3,45
Jane Smith,15,F,gold,180,14,5,38
Alex Johnson,13,M,silver,120,21,7,52
Sam Wilson,16,F,bronze1,75,3,1,22`;

export default function CsvImport({ onImportComplete, teamId }: CsvImportProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [csvData, setCsvData] = useState<CsvRow[]>([]);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, keyof Athlete>>({});
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [importStatus, setImportStatus] = useState<'idle' | 'mapping' | 'validating' | 'importing' | 'complete' | 'error'>('idle');
  const [importResult, setImportResult] = useState<{success: number, failed: number, errors: string[]} | null>(null);
  const [isGoMotionImport, setIsGoMotionImport] = useState(false);
  const [goMotionColumns, setGoMotionColumns] = useState<{
    firstName?: string;
    lastName?: string;
    dob?: string;
    parentName?: string;
    parentEmail?: string;
  }>({});

  const athleteFields: ColumnMapping[] = [
    { csvColumn: '', athleteField: 'id', required: false },
    { csvColumn: '', athleteField: 'name', required: true },
    { csvColumn: '', athleteField: 'age', required: true },
    { csvColumn: '', athleteField: 'gender', required: true },
    { csvColumn: '', athleteField: 'group', required: true },
    { csvColumn: '', athleteField: 'xp', required: false },
    { csvColumn: '', athleteField: 'streak', required: false },
    { csvColumn: '', athleteField: 'weightStreak', required: false },
    { csvColumn: '', athleteField: 'lastStreakDate', required: false },
    { csvColumn: '', athleteField: 'lastWeightStreakDate', required: false },
    { csvColumn: '', athleteField: 'totalPractices', required: false },
    { csvColumn: '', athleteField: 'weekSessions', required: false },
    { csvColumn: '', athleteField: 'weekWeightSessions', required: false },
    { csvColumn: '', athleteField: 'weekTarget', required: false },
    { csvColumn: '', athleteField: 'checkpoints', required: false },
    { csvColumn: '', athleteField: 'weightCheckpoints', required: false },
    { csvColumn: '', athleteField: 'meetCheckpoints', required: false },
    { csvColumn: '', athleteField: 'weightChallenges', required: false },
    { csvColumn: '', athleteField: 'quests', required: false },
    { csvColumn: '', athleteField: 'questNotes', required: false },
    { csvColumn: '', athleteField: 'dailyXP', required: false },
    { csvColumn: '', athleteField: 'parentName', required: false },
    { csvColumn: '', athleteField: 'parentEmail', required: false },
  ];

  const handleFileSelect = useCallback((file: File) => {
    if (!file.name.endsWith('.csv')) {
      setValidationErrors(['Please select a CSV file']);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) {
          setValidationErrors(['CSV file must have at least a header row and one data row']);
          return;
        }

        const headers = lines[0].split(',').map(h => h.trim());
        const rows: CsvRow[] = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const row: CsvRow = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
          rows.push(row);
        }

        setCsvHeaders(headers);
        setCsvData(rows);
        setImportStatus('mapping');
        setValidationErrors([]);
        
        // Auto-map common column names
        const autoMapping: Record<string, keyof Athlete> = {};
        headers.forEach(header => {
          const lowerHeader = header.toLowerCase();
          if (lowerHeader.includes('name')) autoMapping[header] = 'name';
          else if (lowerHeader.includes('age')) autoMapping[header] = 'age';
          else if (lowerHeader.includes('gender') || lowerHeader.includes('sex')) autoMapping[header] = 'gender';
          else if (lowerHeader.includes('group') || lowerHeader.includes('team')) autoMapping[header] = 'group';
          else if (lowerHeader.includes('xp') || lowerHeader.includes('experience')) autoMapping[header] = 'xp';
          else if (lowerHeader.includes('streak')) autoMapping[header] = 'streak';
        });
        setMapping(autoMapping);

        // GoMotion-specific header detection
        const detectedGoMotion: {
          firstName?: string;
          lastName?: string;
          dob?: string;
          parentName?: string;
          parentEmail?: string;
        } = {};

        headers.forEach(header => {
          const lh = header.toLowerCase().trim();
          if (['first name', 'first_name', 'firstname'].includes(lh)) {
            detectedGoMotion.firstName = header;
          } else if (['last name', 'last_name', 'lastname'].includes(lh)) {
            detectedGoMotion.lastName = header;
          } else if (['dob', 'date of birth', 'birth date', 'birthdate'].includes(lh)) {
            detectedGoMotion.dob = header;
          } else if (['parent email', 'parent_email', 'guardian email'].includes(lh)) {
            detectedGoMotion.parentEmail = header;
          } else if (['parent name', 'parent_name', 'guardian name'].includes(lh)) {
            detectedGoMotion.parentName = header;
          }
        });

        setGoMotionColumns(detectedGoMotion);
        if (detectedGoMotion.firstName && detectedGoMotion.lastName) {
          setIsGoMotionImport(true);
          autoMapping[detectedGoMotion.firstName] = 'name';
          if (detectedGoMotion.dob) {
            autoMapping[detectedGoMotion.dob] = 'age';
          }
          if (detectedGoMotion.parentName) {
            autoMapping[detectedGoMotion.parentName] = 'parentName';
          }
          if (detectedGoMotion.parentEmail) {
            autoMapping[detectedGoMotion.parentEmail] = 'parentEmail';
          }
        } else {
          setIsGoMotionImport(false);
        }
      } catch (error) {
        setValidationErrors([`Error parsing CSV: ${error instanceof Error ? error.message : 'Unknown error'}`]);
      }
    };
    reader.readAsText(file);
  }, []);

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  }, [handleFileSelect]);

  const validateMapping = useCallback((): string[] => {
    const errors: string[] = [];
    const requiredFields = athleteFields.filter(f => f.required).map(f => f.athleteField);
    const goMotionAutoFields: (keyof Athlete)[] = isGoMotionImport
      ? ['name', ...(goMotionColumns.dob ? ['age' as keyof Athlete] : [])]
      : [];

    requiredFields.forEach(field => {
      if (goMotionAutoFields.includes(field)) return;
      if (!Object.values(mapping).includes(field)) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Validate gender values
    csvData.forEach((row, index) => {
      const genderField = Object.entries(mapping).find(([_, athleteField]) => athleteField === 'gender');
      if (genderField) {
        const genderValue = row[genderField[0]].toUpperCase();
        if (!['M', 'F'].includes(genderValue)) {
          errors.push(`Row ${index + 2}: Gender must be 'M' or 'F', found '${genderValue}'`);
        }
      }
    });

    // Validate group values
    csvData.forEach((row, index) => {
      const groupField = Object.entries(mapping).find(([_, athleteField]) => athleteField === 'group');
      if (groupField) {
        const groupValue = row[groupField[0]].toLowerCase();
        const validGroups = ['platinum', 'gold', 'silver', 'bronze1', 'bronze2', 'diving', 'waterpolo'];
        if (!validGroups.includes(groupValue)) {
          errors.push(`Row ${index + 2}: Group must be one of: ${validGroups.join(', ')}, found '${groupValue}'`);
        }
      }
    });

    return errors;
  }, [mapping, csvData, athleteFields, isGoMotionImport, goMotionColumns]);

  const handleImport = useCallback(() => {
    const errors = validateMapping();
    if (errors.length > 0) {
      setValidationErrors(errors);
      return;
    }

    setImportStatus('importing');
    
    try {
      const athletes: Athlete[] = csvData.map((row, index) => {
        const athlete: Partial<Athlete> = {
          id: `imported-${Date.now()}-${index}`,
          checkpoints: {},
          weightCheckpoints: {},
          meetCheckpoints: {},
          weightChallenges: {},
          quests: {},
          questNotes: {},
          dailyXP: { date: new Date().toISOString().split('T')[0], pool: 0, weight: 0, meet: 0 },
        };

        // GoMotion: combine firstName + lastName, calc age from DOB, lowercase emails
        if (isGoMotionImport && goMotionColumns.firstName && goMotionColumns.lastName) {
          const first = (row[goMotionColumns.firstName] || '').trim();
          const last = (row[goMotionColumns.lastName] || '').trim();
          athlete.name = `${first} ${last}`.trim();

          if (goMotionColumns.dob) {
            const dobStr = row[goMotionColumns.dob];
            if (dobStr) {
              const dob = new Date(dobStr);
              if (!isNaN(dob.getTime())) {
                const today = new Date();
                let age = today.getFullYear() - dob.getFullYear();
                const monthDiff = today.getMonth() - dob.getMonth();
                if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
                  age--;
                }
                athlete.age = age;
              }
            }
          }

          if (goMotionColumns.parentName) {
            athlete.parentName = (row[goMotionColumns.parentName] || '').trim();
          }
          if (goMotionColumns.parentEmail) {
            athlete.parentEmail = (row[goMotionColumns.parentEmail] || '').trim().toLowerCase();
          }
        }

        // Map CSV columns to athlete fields
        Object.entries(mapping).forEach(([csvColumn, athleteField]) => {
          const value = row[csvColumn];

          switch (athleteField) {
            case 'name':
              if (!isGoMotionImport) athlete.name = value;
              break;
            case 'age':
              if (!isGoMotionImport) athlete.age = parseInt(value) || 0;
              break;
            case 'gender':
              athlete.gender = value.toUpperCase() as 'M' | 'F';
              break;
            case 'group':
              athlete.group = value.toLowerCase();
              break;
            case 'xp':
              athlete.xp = parseInt(value) || 0;
              break;
            case 'streak':
              athlete.streak = parseInt(value) || 0;
              break;
            case 'weightStreak':
              athlete.weightStreak = parseInt(value) || 0;
              break;
            case 'totalPractices':
              athlete.totalPractices = parseInt(value) || 0;
              break;
            case 'lastStreakDate':
            case 'lastWeightStreakDate':
              athlete[athleteField] = value || new Date().toISOString().split('T')[0];
              break;
            case 'weekSessions':
            case 'weekWeightSessions':
            case 'weekTarget':
              athlete[athleteField] = parseInt(value) || 0;
              break;
            case 'parentName':
              if (!isGoMotionImport) athlete.parentName = value;
              break;
            case 'parentEmail':
              if (!isGoMotionImport) athlete.parentEmail = value?.toLowerCase();
              break;
          }
        });

        // Set defaults for missing fields
        return {
          id: athlete.id!,
          name: athlete.name || `Athlete ${index + 1}`,
          age: athlete.age || 0,
          gender: athlete.gender || 'M',
          group: athlete.group || 'platinum',
          xp: athlete.xp || 0,
          streak: athlete.streak || 0,
          weightStreak: athlete.weightStreak || 0,
          lastStreakDate: athlete.lastStreakDate || new Date().toISOString().split('T')[0],
          lastWeightStreakDate: athlete.lastWeightStreakDate || new Date().toISOString().split('T')[0],
          totalPractices: athlete.totalPractices || 0,
          weekSessions: athlete.weekSessions || 0,
          weekWeightSessions: athlete.weekWeightSessions || 0,
          weekTarget: athlete.weekTarget || 0,
          checkpoints: {},
          weightCheckpoints: {},
          meetCheckpoints: {},
          weightChallenges: {},
          quests: {},
          questNotes: {},
          dailyXP: { date: new Date().toISOString().split('T')[0], pool: 0, weight: 0, meet: 0 },
          parentName: athlete.parentName || undefined,
          parentEmail: athlete.parentEmail || undefined,
        } as Athlete;
      });

      // Save to localStorage
      const existingRoster = JSON.parse(localStorage.getItem('apex-athlete-roster-v5') || '[]');
      const updatedRoster = [...existingRoster, ...athletes];
      localStorage.setItem('apex-athlete-roster-v5', JSON.stringify(updatedRoster));

      setImportResult({
        success: athletes.length,
        failed: 0,
        errors: []
      });
      setImportStatus('complete');
      onImportComplete(athletes);
      
    } catch (error) {
      setImportStatus('error');
      setValidationErrors([`Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`]);
    }
  }, [csvData, mapping, validateMapping, onImportComplete, isGoMotionImport, goMotionColumns]);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([CSV_TEMPLATE], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'apex-athlete-template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const handleTestAthlete = useCallback(() => {
    const testAthlete: Athlete = {
      id: 'test-athlete-001',
      name: 'Test Athlete',
      age: 14,
      gender: 'M',
      group: 'platinum',
      xp: 150,
      streak: 7,
      weightStreak: 3,
      lastStreakDate: new Date().toISOString().split('T')[0],
      lastWeightStreakDate: new Date().toISOString().split('T')[0],
      totalPractices: 25,
      weekSessions: 5,
      weekWeightSessions: 2,
      weekTarget: 8,
      checkpoints: {},
      weightCheckpoints: {},
      meetCheckpoints: {},
      weightChallenges: {},
      quests: {},
      questNotes: {},
      dailyXP: { date: new Date().toISOString().split('T')[0], pool: 50, weight: 25, meet: 75 },
    };

    const existingRoster = JSON.parse(localStorage.getItem('apex-athlete-roster-v5') || '[]');
    const updatedRoster = [...existingRoster, testAthlete];
    localStorage.setItem('apex-athlete-roster-v5', JSON.stringify(updatedRoster));

    setImportResult({
      success: 1,
      failed: 0,
      errors: []
    });
    setImportStatus('complete');
    onImportComplete([testAthlete]);
  }, [onImportComplete]);

  if (importStatus === 'complete' && importResult) {
    return (
      <div className="p-6 bg-green-50 border border-green-200 rounded-lg">
        <div className="flex items-center mb-4">
          <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center mr-3">
            <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-green-800">Import Complete!</h3>
        </div>
        <div className="space-y-2">
          <p className="text-green-700">
            Successfully imported <span className="font-bold">{importResult.success}</span> athletes.
          </p>
          {importResult.failed > 0 && (
            <p className="text-amber-700">
              <span className="font-bold">{importResult.failed}</span> athletes failed to import.
            </p>
          )}
          <button
            onClick={() => {
              setImportStatus('idle');
              setCsvData([]);
              setImportResult(null);
            }}
            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            Import Another File
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <div
        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <div className="max-w-md mx-auto">
          <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">Import Athletes from CSV</h3>
          <p className="text-gray-600 mb-4">
            Drag and drop your CSV file here, or click to browse
          </p>
          <input
            type="file"
            accept=".csv"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileSelect(file);
            }}
            className="hidden"
            id="csv-file-input"
          />
          <label
            htmlFor="csv-file-input"
            className="inline-block px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 cursor-pointer transition-colors"
          >
            Select CSV File
          </label>
          <div className="mt-6">
            <button
              onClick={handleDownloadTemplate}
              className="text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download CSV Template
            </button>
          </div>
        </div>
      </div>

      {/* Column Mapping UI */}
      {importStatus === 'mapping' && csvData.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Map CSV Columns</h3>
              <p className="text-sm text-gray-600">
                Found {csvData.length} athletes in file. Map CSV columns to athlete fields.
              </p>
            </div>
            <button
              onClick={handleTestAthlete}
              className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors text-sm font-medium"
            >
              Test with Sample Athlete
            </button>
          </div>

          {/* GoMotion Auto-Detect Banner */}
          {isGoMotionImport && (
            <div className="mb-6 p-4 rounded-lg border-2 bg-[#0a0a1a] border-[#00f0ff]/30">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[#00f0ff]/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-5 h-5 text-[#00f0ff]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-[#00f0ff]">GoMotion Format Detected</h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Auto-mapping: {goMotionColumns.firstName} + {goMotionColumns.lastName} → name
                    {goMotionColumns.dob && `, ${goMotionColumns.dob} → age`}
                    {goMotionColumns.parentEmail && `, ${goMotionColumns.parentEmail} → parentEmail`}
                    {goMotionColumns.parentName && `, ${goMotionColumns.parentName} → parentName`}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* CSV Preview */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-2">CSV Preview (First 3 rows)</h4>
            <div className="overflow-x-auto border border-gray-200 rounded">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {csvHeaders.map((header, index) => (
                      <th key={index} className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {csvData.slice(0, 3).map((row, rowIndex) => (
                    <tr key={rowIndex} className="hover:bg-gray-50">
                      {csvHeaders.map((header, colIndex) => (
                        <td key={colIndex} className="px-4 py-2 text-sm text-gray-900">
                          {row[header] || <span className="text-gray-400 italic">empty</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Column Mapping */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium text-gray-700">Map Columns</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {athleteFields
                .filter(field => field.athleteField !== 'id' && field.athleteField !== 'dailyXP')
                .map((field) => (
                  <div key={field.athleteField} className="space-y-2">
                    <label className="block text-sm font-medium text-gray-700">
                      {field.athleteField}
                      {field.required && <span className="text-red-500 ml-1">*</span>}
                    </label>
                    <select
                      value={Object.entries(mapping).find(([_, v]) => v === field.athleteField)?.[0] || ''}
                      onChange={(e) => {
                        const newMapping = { ...mapping };
                        // Remove old mapping for this field
                        Object.keys(newMapping).forEach(key => {
                          if (newMapping[key] === field.athleteField) {
                            delete newMapping[key];
                          }
                        });
                        // Add new mapping
                        if (e.target.value) {
                          newMapping[e.target.value] = field.athleteField;
                        }
                        setMapping(newMapping);
                      }}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Not mapped</option>
                      {csvHeaders.map(header => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </div>
                ))}
            </div>
          </div>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <div className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center mb-2">
                <svg className="w-5 h-5 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.464 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <h4 className="text-sm font-medium text-red-800">Validation Errors</h4>
              </div>
              <ul className="text-sm text-red-700 list-disc pl-5 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex items-center justify-between">
            <div className="text-sm text-gray-600">
              {Object.keys(mapping).length} of {athleteFields.filter(f => f.required).length} required fields mapped
            </div>
            <div className="space-x-4">
              <button
                onClick={() => {
                  setCsvData([]);
                  setImportStatus('idle');
                  setValidationErrors([]);
                }}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleImport}
                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Import Athletes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Importing State */}
      {importStatus === 'importing' && (
        <div className="p-6 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-3">
              <svg className="animate-spin h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-blue-800">Importing Athletes</h3>
              <p className="text-blue-700">Adding {csvData.length} athletes to your roster...</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
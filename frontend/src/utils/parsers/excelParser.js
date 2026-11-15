// utils/parsers/excelParser.js
import readXlsxFile from 'read-excel-file/browser';

export class ExcelParser {
  static async parse(file) {
    if (!file || !/\.xlsx$/i.test(file.name || '')) {
      throw new Error('Please upload a modern Excel .xlsx workbook. Legacy .xls is not supported.');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new Error('Workbook exceeds the 10 MB import limit.');
    }
    const matrix = await readXlsxFile(file);
    if (!matrix.length) throw new Error('Workbook contains no rows.');
    if (matrix.length > 5001) throw new Error('Workbook exceeds the 5,000 task import limit.');
    const headers = matrix[0].map(value => String(value ?? '').trim());
    const groups = new Map();
    const tasks = [];
    for (const [index, cells] of matrix.slice(1).entries()) {
      if (cells.every(value => value === null || value === '')) continue;
      const row = Object.fromEntries(headers.map((header, i) => [header, cells[i]]));
      const task = {
        id: `imported-${Date.now()}-${index}-${Math.random()}`,
        name: row['Task Name'] || row['Name'] || row['Task'] || `Task ${index + 1}`,
        startDate: this.parseExcelDate(row['Start Date'] || row['Start']),
        endDate: this.parseExcelDate(row['End Date'] || row['End'] || row['Finish']),
        durationDays: Number.parseInt(row['Duration'] || row['Days'] || 0, 10) || 0,
        progress: Math.max(0, Math.min(100, Number.parseInt(row['Progress'] || row['% Complete'] || 0, 10) || 0)),
        isMilestone: (row['Type'] === 'Milestone' || row['Milestone'] === 'Yes'),
        owner: row['Owner'] || row['Assigned To'] || '',
        relationships: []
      };
      if (!task.durationDays && task.startDate && task.endDate) {
        const diff = new Date(task.endDate) - new Date(task.startDate);
        task.durationDays = Math.max(0, Math.ceil(diff / 86400000));
      }
      task.duration = `${task.durationDays} days`;
      const groupName = row['Swimlane'] || row['Phase'] || row['Group'] || 'Imported Tasks';
      if (!groups.has(groupName)) groups.set(groupName, []);
      groups.get(groupName).push(task);
      tasks.push(task);
    }
    const timelineGroups = [...groups].map(([name, groupedTasks], index) => ({
      id: `swimlane-${Date.now()}-${index}`,
      name, expanded: true, subGroups: [], tasks: groupedTasks
    }));
    const summary = {
      totalTasks: tasks.length,
      totalDuration: tasks.reduce((sum, task) => sum + task.durationDays, 0),
      overallProgress: tasks.length
        ? Math.round(tasks.reduce((sum, task) => sum + task.progress, 0) / tasks.length) : 0,
      milestoneCount: tasks.filter(task => task.isMilestone).length
    };
    return { groups: timelineGroups, summary };
  }

  static parseExcelDate(dateValue) {
    if (!dateValue) return '';
    
    if (dateValue instanceof Date) return Number.isNaN(dateValue.getTime()) ? '' : dateValue.toISOString().slice(0,10);
    // If it's a string, try to parse it
    if (typeof dateValue === 'string') {
      const parsed = new Date(dateValue);
      if (!isNaN(parsed.getTime())) {
        return parsed.toISOString().split('T')[0];
      }
      return '';
    }
    
    // If it's an Excel serial number
    if (typeof dateValue === 'number') {
      const date = new Date((dateValue - 25569) * 86400 * 1000);
      return date.toISOString().split('T')[0];
    }
    
    return '';
  }
}
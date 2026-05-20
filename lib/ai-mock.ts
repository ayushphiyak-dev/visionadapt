import { AIAnalysis, ComplaintCategory, UrgencyLevel } from './types';

export function analyzeComplaint(
  title: string,
  description: string,
  category: ComplaintCategory
): AIAnalysis {
  // Mock AI analysis
  const keywords = extractKeywords(title + ' ' + description);
  const sentiment = analyzeSentiment(description);
  const urgency = determineUrgency(title, description);
  const confidence = Math.floor(Math.random() * 15) + 85; // 85-100

  return {
    confidence,
    category,
    urgency,
    sentiment,
    keywords,
    flagged: checkForFlags(title, description),
    analyzedAt: new Date().toISOString(),
  };
}

function extractKeywords(text: string): string[] {
  const commonWords = ['the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'but', 'in', 'with', 'to', 'for', 'of', 'as', 'by'];
  const words = text.toLowerCase().match(/\b\w+\b/g) || [];
  const filtered = words.filter(w => w.length > 3 && !commonWords.includes(w));
  const frequency: Record<string, number> = {};
  
  filtered.forEach(word => {
    frequency[word] = (frequency[word] || 0) + 1;
  });
  
  return Object.entries(frequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);
}

function analyzeSentiment(text: string): 'negative' | 'neutral' | 'positive' {
  const negativeWords = ['broken', 'damaged', 'unsafe', 'dirty', 'bad', 'poor', 'terrible', 'worst', 'dangerous', 'unhygienic'];
  const positiveWords = ['good', 'excellent', 'clean', 'safe', 'better', 'improved'];
  
  const lowerText = text.toLowerCase();
  const negCount = negativeWords.filter(word => lowerText.includes(word)).length;
  const posCount = positiveWords.filter(word => lowerText.includes(word)).length;
  
  if (negCount > posCount + 1) return 'negative';
  if (posCount > negCount) return 'positive';
  return 'neutral';
}

function determineUrgency(title: string, description: string): UrgencyLevel {
  const text = (title + ' ' + description).toLowerCase();
  
  const criticalKeywords = ['dangerous', 'unsafe', 'emergency', 'urgent', 'critical', 'immediate', 'serious injury'];
  const highKeywords = ['broken', 'damaged', 'leak', 'electrical', 'security', 'harassment'];
  const mediumKeywords = ['issue', 'problem', 'concern', 'needs', 'repair'];
  
  if (criticalKeywords.some(k => text.includes(k))) return 'critical';
  if (highKeywords.some(k => text.includes(k))) return 'high';
  if (mediumKeywords.some(k => text.includes(k))) return 'medium';
  return 'low';
}

function checkForFlags(title: string, description: string): boolean {
  const flagWords = ['abuse', 'threat', 'violence', 'illegal', 'discrimination'];
  const text = (title + ' ' + description).toLowerCase();
  return flagWords.some(word => text.includes(word));
}

export function detectDuplicates(
  newComplaint: { title: string; description: string; category: ComplaintCategory },
  existingComplaints: Array<{ id: string; title: string; description: string; category: ComplaintCategory }>
): string | null {
  // Simple duplicate detection based on similar titles and same category
  for (const existing of existingComplaints) {
    if (existing.category !== newComplaint.category) continue;
    
    const similarity = calculateSimilarity(newComplaint.title, existing.title);
    if (similarity > 0.8) {
      return existing.id;
    }
  }
  return null;
}

function calculateSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return intersection.size / union.size;
}

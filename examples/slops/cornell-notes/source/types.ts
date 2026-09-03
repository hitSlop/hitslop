export type CornellItem = {
  id: string;
  cue: string;      // Key question, vocabulary, or recall prompt
  notes: string;    // Detailed bullet points, definitions, formulas
};

export type CornellNoteData = {
  topic: string;
  course: string;
  date: string;
  lecturer: string;
  items: CornellItem[];
  summary: string;
  theme?: "light" | "dark";
};

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, Search, Upload, Download, FileText, GraduationCap, LibraryBig, Trash2, X, Menu } from "lucide-react";

type Book = {
  id: string; title: string; author: string; course: string; department: string;
  level: string; description: string; fileName: string; dataUrl?: string; fileBlob?: Blob; addedAt: number;
};

const DEPARTMENTS = [
  "Accounting", "Actuarial Science and Insurance", "Adult Education",
  "Anatomy", "Architecture", "Arts Education", "Biochemistry",
  "Biomedical Engineering", "Botany", "Building", "Business Administration",
  "Cell Biology and Genetics", "Chemical Engineering", "Chemistry",
  "Civil Engineering", "Clinical Pharmacy and Biopharmacy",
  "Commercial and Industrial Law", "Computer Engineering", "Computer Science",
  "Creative Arts", "Cybersecurity", "Dentistry", "Economics",
  "Educational Foundations", "Educational Management", "Electrical and Electronics Engineering",
  "Employment Relations and Human Resource Management", "English",
  "Estate Management", "European Languages and Integration Studies",
  "Finance", "Fisheries and Aquaculture", "Geography", "Geology",
  "Geophysics", "Geosciences", "History and Strategic Studies",
  "Human Kinetics and Health Education", "Industrial Relations and Personnel Management",
  "Interior Architecture and Design", "Jurisprudence and International Law",
  "Landscape Architecture and Urban Design", "Law", "Library and Information Science",
  "Linguistics, African and Asian Studies", "Marine Science",
  "Mass Communication", "Mathematics", "Mechanical Engineering",
  "Medical Biochemistry", "Medical Laboratory Science", "Medicine and Surgery",
  "Metallurgical and Materials Engineering", "Microbiology", "Nursing Science",
  "Obstetrics and Gynaecology", "Pharmaceutical Chemistry", "Pharmacognosy",
  "Pharmacology, Therapeutics and Toxicology", "Pharmacy", "Philosophy",
  "Physics", "Physiology", "Political Science", "Psychology",
  "Public Law", "Quantity Surveying", "Radiography", "Religious Studies",
  "Social Work", "Sociology", "Statistics", "Surveying and Geoinformatics",
  "Systems Engineering", "Theatre Arts and Film Studies",
  "Urban and Regional Planning", "Zoology", "Other / Custom Department"
];

const STORE_KEY = "departmental-e-library-books-v1";


function openLibraryDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("departmental-e-library-db", 1);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("books")) {
        db.createObjectStore("books", { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function saveBookToDB(book: Book): Promise<void> {
  const db = await openLibraryDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("books", "readwrite");
    tx.objectStore("books").put(book);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

async function getBooksFromDB(): Promise<Book[]> {
  const db = await openLibraryDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("books", "readonly");
    const request = tx.objectStore("books").getAll();

    request.onsuccess = () => resolve(request.result as Book[]);
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
    tx.onerror = () => { db.close(); reject(tx.error); };
  });
}

async function deleteBookFromDB(id: string): Promise<void> {
  const db = await openLibraryDB();

  return new Promise((resolve, reject) => {
    const tx = db.transaction("books", "readwrite");
    tx.objectStore("books").delete(id);
    tx.oncomplete = () => { db.close(); resolve(); };
    tx.onerror = () => { db.close(); reject(tx.error); };
    tx.onabort = () => { db.close(); reject(tx.error); };
  });
}

export default function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState("All departments");
  const [level, setLevel] = useState("All levels");
  const [showUpload, setShowUpload] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ title: "", author: "", course: "", department: "Mass Communication", level: "100 Level", description: "" });
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    let active = true;

    async function initialiseLibrary() {
      try {
        const savedBooks = await getBooksFromDB();
        const combined = new Map<string, Book>(
          savedBooks.map(book => [book.id, book])
        );

        // Import previous localStorage entries without discarding them
        // until their records have been migrated successfully.
        const legacyText = localStorage.getItem(STORE_KEY);
        if (legacyText) {
          const legacyBooks = JSON.parse(legacyText) as Book[];

          for (const oldBook of legacyBooks) {
            let fileBlob = oldBook.fileBlob;

            if (!fileBlob && oldBook.dataUrl) {
              const response = await fetch(oldBook.dataUrl);
              fileBlob = await response.blob();
            }

            const { dataUrl: _oldDataUrl, ...metadata } = oldBook;
            const migrated: Book = { ...metadata, fileBlob };

            await saveBookToDB(migrated);
            combined.set(migrated.id, migrated);
          }

          // Remove the old copy only after all migration writes succeeded.
          localStorage.removeItem(STORE_KEY);
        }

        if (active) {
          setBooks(
            [...combined.values()].sort((a, b) => b.addedAt - a.addedAt)
          );
        }
      } catch (error) {
        console.error("Could not initialise local library:", error);
        if (active) {
          setNotice(
            "Could not load browser storage. Check available device storage and reload."
          );
        }
      }
    }

    void initialiseLibrary();
    return () => { active = false; };
  }, []);

  const departments = useMemo(() => ["All departments", ...new Set([...DEPARTMENTS, ...books.map(b => b.department)])].sort((a, b) => a === "All departments" ? -1 : b === "All departments" ? 1 : a.localeCompare(b)), [books]);
  const filtered = useMemo(() => books.filter(b => {
    const haystack = `${b.title} ${b.author} ${b.course} ${b.department} ${b.description}`.toLowerCase();
    return haystack.includes(query.toLowerCase()) &&
      (department === "All departments" || b.department === department) &&
      (level === "All levels" || b.level === level);
  }).sort((a, b) => b.addedAt - a.addedAt), [books, query, department, level]);

  async function uploadBook(e: ChangeEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!file) {
      setNotice("Choose a PDF or e-book file first.");
      return;
    }

    const allowedExtensions = ["pdf", "epub", "mobi", "azw3", "txt"];
    const extension = file.name.split(".").pop()?.toLowerCase() || "";

    if (!allowedExtensions.includes(extension)) {
      setNotice("Allowed formats: PDF, EPUB, MOBI, AZW3 and TXT.");
      return;
    }

    if (file.size > 200 * 1024 * 1024) {
      setNotice("The file must be 200 MB or smaller.");
      return;
    }

    const item: Book = {
      ...form,
      id: crypto.randomUUID(),
      fileName: file.name,
      fileBlob: file,
      addedAt: Date.now()
    };

    try {
      await saveBookToDB(item);
      setBooks(previous => [item, ...previous]);
      setNotice("Resource saved in this browser's storage.");
      setShowUpload(false);
      setForm({
        title: "",
        author: "",
        course: "",
        department: "Mass Communication",
        level: "100 Level",
        description: ""
      });
      setFile(null);
    } catch (error) {
      console.error("Could not save uploaded file:", error);
      setNotice(
        "The file could not be saved. Check browser storage space and permissions."
      );
    }
  }

  function downloadBook(book: Book) {
    if (book.fileBlob) {
      const url = URL.createObjectURL(book.fileBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = book.fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      return;
    }

    // Compatibility fallback for any older entry not yet migrated.
    if (book.dataUrl) {
      const a = document.createElement("a");
      a.href = book.dataUrl;
      a.download = book.fileName;
      a.click();
      return;
    }

    setNotice("The file data is missing. Please upload the file again.");
  }

  async function deleteBook(book: Book) {
    if (!confirm(`Delete "${book.title}" from this device?`)) return;

    try {
      await deleteBookFromDB(book.id);
      setBooks(previous => previous.filter(item => item.id !== book.id));
      setNotice("Resource deleted from this device.");
    } catch (error) {
      console.error("Could not delete resource:", error);
      setNotice("Could not delete this resource. Please try again.");
    }
  }

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#"><span className="brand-mark"><LibraryBig size={23}/></span><span><b>Departmental</b><small>E-LIBRARY</small></span></a>
      <button className="menu-toggle" aria-label="Toggle menu" onClick={() => setMobileMenu(!mobileMenu)}><Menu/></button>
      <nav className={mobileMenu ? "nav-links open" : "nav-links"}>
        <a href="#library" onClick={() => setMobileMenu(false)}>Explore library</a>
        <a href="#about" onClick={() => setMobileMenu(false)}>About</a>
        <button className="button button-dark nav-upload" onClick={() => setShowUpload(true)}><Upload size={16}/> Upload PDF / E-book</button>
      </nav>
    </header>

    <main>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow"><span></span> YOUR KNOWLEDGE, CONNECTED</div>
          <h1>Learning grows<br/>when we <em>share.</em></h1>
          <p>A central home for lecture notes, course materials, and academic resources — organised for your department, made for your success.</p>
          <a className="button button-gold" href="#library">Explore the library <span>↗</span></a>
          <div className="hero-stats"><div><b>{books.length.toLocaleString()}</b><span>Resources listed</span></div><div><b>{departments.length - 1}</b><span>Departments</span></div><div><b>PDF</b><span>Resource format</span></div></div>
        </div>
        <div className="hero-art" aria-label="Academic library illustration">
          <div className="art-glow"></div><div className="art-card card-back"><span>ACADEMIC COLLECTION</span><div className="book-lines"></div></div>
          <div className="art-card card-front"><div className="art-emblem"><GraduationCap size={39}/></div><div className="art-rule"></div><strong>Knowledge<br/>is a shared<br/><i>resource.</i></strong><span className="art-foot">LEARN · SHARE · GROW</span></div>
          <div className="art-stamp"><BookOpen size={20}/><span>Curated for<br/><b>your journey</b></span></div>
        </div>
      </section>

      <section className="library-section" id="library">
        <div className="section-heading"><div><div className="eyebrow">THE COLLECTION</div><h2>Explore the library</h2><p>Find the resources you need for your next breakthrough.</p></div><button className="button button-outline desktop-upload" onClick={() => setShowUpload(true)}><Upload size={16}/> Upload PDF / E-book</button></div>
        <div className="search-panel">
          <div className="search-box"><Search size={19}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search titles, courses, authors..." aria-label="Search resources"/></div>
          <select value={department} onChange={e => setDepartment(e.target.value)} aria-label="Filter by department">{departments.map(d => <option key={d}>{d}</option>)}</select>
          <select value={level} onChange={e => setLevel(e.target.value)} aria-label="Filter by level">{["All levels","100 Level","200 Level","300 Level","400 Level","500 Level"].map(l => <option key={l}>{l}</option>)}</select>
        </div>
        <div className="results-line"><span>{filtered.length} {filtered.length === 1 ? "resource" : "resources"} found</span><span>Sorted by recently added</span></div>
        {filtered.length ? <div className="resource-grid">{filtered.map(book => <article className="resource-card" key={book.id}>
          <div className="resource-card-top"><div className="pdf-icon"><FileText size={22}/></div><span className="format-tag">{(book.fileName.split(".").pop() || "FILE").toUpperCase()} RESOURCE</span></div>
          <span className="resource-dept">{book.department} · {book.level}</span><h3>{book.title}</h3><p className="resource-description">{book.description || "Academic resource shared with the library."}</p>
          <div className="resource-meta"><span>By {book.author || "Contributor"}</span><span>{book.course || "Course material"}</span></div>
          <div className="resource-actions"><button className="button button-dark" onClick={() => downloadBook(book)}><Download size={15}/> Download file</button><button className="icon-button" title="Delete this resource from this device" onClick={() => deleteBook(book)}><Trash2 size={16}/></button></div>
        </article>)}</div> : <div className="empty-state"><div className="empty-icon"><Search size={26}/></div><h3>Your library is ready for uploads</h3><p>There are no resources yet. Upload your first PDF or e-book to get started.</p><button className="button button-outline" onClick={() => {setQuery("");setDepartment("All departments");setLevel("All levels");}}>Clear filters</button></div>}
      </section>

      <section className="contribute-banner" id="about"><div className="banner-icon"><BookOpen size={27}/></div><div><h2>Have notes worth sharing?</h2><p>Help another student get one step closer to understanding.</p></div><button className="button button-gold" onClick={() => setShowUpload(true)}>Upload PDF / E-book <span>↗</span></button></section>
    </main>
    <footer><a className="brand footer-brand" href="#"><span className="brand-mark"><LibraryBig size={20}/></span><span><b>Departmental</b><small>E-LIBRARY</small></span></a><p>Built around the idea that knowledge is better when shared.</p><span>© {new Date().getFullYear()} Departmental E-Library</span></footer>

    {notice && <div className="toast" role="status"><span>{notice}</span><button onClick={() => setNotice("")} aria-label="Dismiss"><X size={16}/></button></div>}
    {showUpload && <div className="modal-backdrop" onMouseDown={e => {if(e.target === e.currentTarget) setShowUpload(false);}}><section className="upload-modal" role="dialog" aria-modal="true" aria-labelledby="upload-title">
      <div className="modal-heading"><div><div className="eyebrow">GROW THE COLLECTION</div><h2 id="upload-title">Upload PDF / E-book</h2><p>Upload an e-book for this browser's local library (up to 200 MB).</p></div><button className="icon-button" onClick={() => setShowUpload(false)} aria-label="Close"><X/></button></div>
      <form onSubmit={uploadBook} className="upload-form">
        <label>Resource title *<input required maxLength={120} value={form.title} onChange={e => setForm({...form,title:e.target.value})} placeholder="e.g. Introduction to Journalism"/></label>
        <div className="form-row"><label>Author / contributor<input value={form.author} onChange={e => setForm({...form,author:e.target.value})} placeholder="Your name"/></label><label>Course<input value={form.course} onChange={e => setForm({...form,course:e.target.value})} placeholder="Course title or code"/></label></div>
        <div className="form-row"><label>Department *<input required value={form.department} onChange={e => setForm({...form,department:e.target.value})}/></label><label>Level *<select value={form.level} onChange={e => setForm({...form,level:e.target.value})}>{["100 Level","200 Level","300 Level","400 Level","500 Level"].map(l=><option key={l}>{l}</option>)}</select></label></div>
        <label>Description<textarea rows={3} maxLength={350} value={form.description} onChange={e => setForm({...form,description:e.target.value})} placeholder="What will students learn from this resource?"/></label>
        <label className="file-picker"><Upload size={20}/><span><b>{file ? file.name : "Choose a PDF or e-book file"}</b><small>PDF, EPUB, MOBI, AZW3 or TXT · max 200 MB · stored on this device</small></span><input required type="file" accept=".pdf,.epub,.mobi,.azw3,.txt,application/pdf,application/epub+zip,text/plain" onChange={e => setFile(e.target.files?.[0] || null)}/></label>
        <div className="modal-actions"><button type="button" className="button button-outline" onClick={() => setShowUpload(false)}>Cancel</button><button type="submit" className="button button-dark"><Upload size={16}/> Add resource</button></div>
      </form>
      <p className="local-warning">Demo mode: resources and PDFs are stored in this browser only. They are not shared with other users or synced to a server.</p>
    </section></div>}
  </div>;
}
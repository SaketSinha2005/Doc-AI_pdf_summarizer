from fastapi import FastAPI, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from datetime import date
from io import BytesIO
from typing import List, Literal

from pydantic import BaseModel, Field
from pypdf import PdfReader
from dotenv import load_dotenv

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from langchain_core.documents import Document
from langchain_core.vectorstores import InMemoryVectorStore
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate

app = FastAPI()
load_dotenv()

llm = ChatOpenAI(temperature=0, model="gpt-4o-mini")
embeddings = OpenAIEmbeddings(model="text-embedding-3-small")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class Insight(BaseModel):
    type: Literal["positive", "neutral", "risk"] = Field(
        description="positive = favorable finding, neutral = notable fact, "
                    "risk = a concern, warning, or open issue"
    )
    heading: str = Field(description="Short 2-5 word heading for the insight")
    description: str = Field(description="1-2 sentence explanation, grounded in the document")


class DataPoint(BaseModel):
    label: str = Field(description="Name of the metric or data field")
    value: str = Field(description="The value, as stated in the document (include units)")
    note: str = Field(default="", description="Optional short context; empty string if none")


class DocumentReport(BaseModel):
    title: str = Field(description="Short descriptive title for the document, under 8 words")
    summary: str = Field(description="A comprehensive, well-organized summary, 2-4 paragraphs")
    insights: List[Insight] = Field(
        description="3-5 key insights surfaced from the document. If the document is short "
                    "or has little to analyze, return fewer rather than padding with filler."
    )
    data_points: List[DataPoint] = Field(
        description="Concrete numbers/metrics/dates explicitly stated in the document "
                    "(e.g. figures, percentages, quantities). Return an empty list if the "
                    "document contains no such concrete data points — do not invent any."
    )


structured_llm = llm.with_structured_output(DocumentReport)


@app.post("/summarize")
async def summarize_pdf(file: UploadFile = File(...)):
    print(f"Starting RAG pipeline for: {file.filename}")

    pdf_bytes = await file.read()
    pdf_file_obj = BytesIO(pdf_bytes)
    pdf_reader = PdfReader(pdf_file_obj)

    total_pages = len(pdf_reader.pages)
    pages_with_text = 0
    extracted_text = ""

    for page in pdf_reader.pages:
        text = page.extract_text()
        if text and text.strip():
            pages_with_text += 1
            extracted_text += text + "\n"

    extraction_confidence = round((pages_with_text / total_pages) * 100, 1) if total_pages else 0.0

    if not extracted_text.strip():
        return {
            "filename": file.filename,
            "date": date.today().isoformat(),
            "pages_analyzed": total_pages,
            "extraction_confidence": extraction_confidence,
            "title": "Unreadable Document",
            "summary": "Could not extract any readable text from this PDF. It may be a "
                        "scanned image without OCR text, or password-protected.",
            "insights": [],
            "data_points": [],
        }

    text_splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=200)
    chunks = text_splitter.split_text(extracted_text)
    docs = [Document(page_content=chunk) for chunk in chunks]

    vector_store = InMemoryVectorStore.from_documents(docs, embeddings)
    retriever = vector_store.as_retriever(search_kwargs={"k": 5})

    analysis_queries = [
        "What is the primary objective, thesis, or purpose of this document?",
        "What are the key points, core arguments, or main findings discussed?",
        "What are the final conclusions, takeaways, or next steps outlined?",
        "What specific numbers, metrics, dates, or figures are stated in this document?",
    ]

    extracted_context_blocks = []
    for query in analysis_queries:
        relevant_docs = retriever.invoke(query)
        context = "\n\n".join(doc.page_content for doc in relevant_docs)
        extracted_context_blocks.append(f"Q: {query}\n{context}")

    combined_context = "\n\n---\n\n".join(extracted_context_blocks)

    synthesis_prompt = ChatPromptTemplate.from_template("""
You are an expert research assistant producing a structured report on a document.
Base every claim strictly on the context below — do not invent facts, numbers, or
data points that are not present in the context.

Context extracted from the document:
{context}

Produce a title, a comprehensive summary, 3-5 key insights, and any concrete data
points explicitly present in the context.
""")

    chain = synthesis_prompt | structured_llm
    report: DocumentReport = chain.invoke({"context": combined_context})

    return {
        "filename": file.filename,
        "date": date.today().isoformat(),
        "pages_analyzed": total_pages,
        "extraction_confidence": extraction_confidence,
        **report.model_dump(),
    }
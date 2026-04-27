import os
import requests
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Ensure static folder is found correctly in production
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, 'static')

app = Flask(__name__, static_folder=static_dir, static_url_path='')
CORS(app)

# Supabase Configuration
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
TABLE_NAME = os.getenv("TABLE_NAME", "users")

# Headers for Supabase REST API
HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=representation"
}

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

@app.route('/health', methods=['GET'])
def health_check():
    return jsonify({"status": "healthy", "static_folder": app.static_folder}), 200

@app.route('/read', methods=['GET'])
def get_users():
    try:
        url = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}?select=*"
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        return jsonify(response.json()), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/create', methods=['POST'])
def create_user():
    try:
        data = request.json
        if not data.get('name') or not data.get('email'):
            return jsonify({"error": "Name and Email are required"}), 400
        
        url = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}"
        response = requests.post(url, headers=HEADERS, json=data)
        response.raise_for_status()
        return jsonify(response.json()[0]), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/update/<int:user_id>', methods=['PUT'])
def update_user(user_id):
    try:
        data = request.json
        url = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}?id=eq.{user_id}"
        response = requests.patch(url, headers=HEADERS, json=data)
        response.raise_for_status()
        return jsonify(response.json()[0]), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/delete/<int:user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        url = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}?id=eq.{user_id}"
        response = requests.delete(url, headers=HEADERS)
        response.raise_for_status()
        return jsonify({"message": "User deleted successfully"}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# Ollama Configuration
OLLAMA_URL = os.getenv("OLLAMA_URL", "http://localhost:11434/api/generate")

def call_ollama(prompt, context_data=None):
    try:
        system_rules = """
        You are a sophisticated AI Database Assistant for a User Management CRUD application.
        
        DATABASE CONTEXT:
        - Table: users
        - Schema: {id: integer, name: string, email: string, age: integer (optional)}
        - Current Data: """ + str(context_data) + """

        CAPABILITIES:
        1. Query Data: Summarize, filter, or analyze the current users.
        2. Perform Actions: Interpret user intent to CREATE, UPDATE, or DELETE users.
        
        OUTPUT FORMAT RULES:
        - If the user wants to PERFORM AN ACTION (Add, Update, Delete):
          Return ONLY a valid JSON object in this format:
          {"action": "CREATE", "data": {"name": "...", "email": "..."}}
          {"action": "UPDATE", "id": 123, "data": {"name": "..."}}
          {"action": "DELETE", "id": 123}
          
        - If the user asks a QUESTION or for a SUMMARY:
          Return a concise, helpful text response.
          
        - DO NOT include conversational filler like "Sure!" or "Here is the JSON".
        - If an action is requested but data is missing, ask for it in text.
        """
        
        payload = {
            "model": "mistral",
            "prompt": f"{system_rules}\n\nUser Query: {prompt}",
            "stream": False,
            "options": {
                "temperature": 0.1,
                "num_predict": 500,
                "top_k": 20,
                "top_p": 0.9
            }
        }
        
        response = requests.post(OLLAMA_URL, json=payload, timeout=120)
        response.raise_for_status()
        return response.json().get("response", "I'm sorry, I couldn't process that.").strip()
    except requests.exceptions.ConnectionError:
        return "AI Error: Ollama is not running. Please start Ollama on your machine."
    except Exception as e:
        return f"AI Error: {str(e)}"

@app.route('/ai-query', methods=['POST'])
def ai_query():
    try:
        user_input = request.json.get('prompt')
        if not user_input:
            return jsonify({"error": "Prompt is required"}), 400

        # Fetch current data for context
        db_url = f"{SUPABASE_URL}/rest/v1/{TABLE_NAME}?select=*"
        db_response = requests.get(db_url, headers=HEADERS)
        db_data = db_response.json() if db_response.ok else []

        ai_response = call_ollama(user_input, db_data)
        
        return jsonify({"response": ai_response}), 200
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)

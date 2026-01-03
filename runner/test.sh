#!/bin/bash

# Script para testar os endpoints do Runner

echo "🧪 Testing SourceRank Runner API Endpoints"
echo "=========================================="
echo ""

# Test 1: Health Check
echo "1️⃣  Testing Health Check Endpoint..."
curl -s http://localhost:3001/health | jq . || echo "❌ Health check failed"
echo ""

# Test 2: Python Execution
echo "2️⃣  Testing Python Code Execution..."
curl -s -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-python-001",
    "language": "python",
    "code": "print(\"Hello from Python\")\nprint(\"2 + 2 =\", 2 + 2)"
  }' | jq . || echo "❌ Python execution failed"
echo ""

# Test 3: JavaScript Execution
echo "3️⃣  Testing JavaScript Code Execution..."
curl -s -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-js-001",
    "language": "javascript",
    "code": "console.log(\"Hello from JavaScript\");\nconsole.log(\"2 + 2 =\", 2 + 2);"
  }' | jq . || echo "❌ JavaScript execution failed"
echo ""

# Test 4: Java Execution
echo "4️⃣  Testing Java Code Execution..."
curl -s -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-java-001",
    "language": "java",
    "code": "public class Main {\n  public static void main(String[] args) {\n    System.out.println(\"Hello from Java\");\n    System.out.println(\"2 + 2 = \" + (2 + 2));\n  }\n}"
  }' | jq . || echo "❌ Java execution failed"
echo ""

# Test 5: Go Execution
echo "5️⃣  Testing Go Code Execution..."
curl -s -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-go-001",
    "language": "go",
    "code": "package main\nimport \"fmt\"\nfunc main() {\n  fmt.Println(\"Hello from Go\")\n  fmt.Println(\"2 + 2 =\", 2 + 2)\n}"
  }' | jq . || echo "❌ Go execution failed"
echo ""

# Test 6: C# Execution
echo "6️⃣  Testing C# Code Execution..."
curl -s -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-csharp-001",
    "language": "csharp",
    "code": "using System;\npublic class Program {\n  public static void Main() {\n    Console.WriteLine(\"Hello from C#\");\n    Console.WriteLine(\"2 + 2 = \" + (2 + 2));\n  }\n}"
  }' | jq . || echo "❌ C# execution failed"
echo ""

# Test 7: Invalid Language
echo "7️⃣  Testing Invalid Language Error..."
curl -s -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-invalid-001",
    "language": "ruby",
    "code": "puts \"Hello\""
  }' | jq . || echo "❌ Invalid language test failed"
echo ""

# Test 8: Missing Fields
echo "8️⃣  Testing Missing Fields Error..."
curl -s -X POST http://localhost:3001/execute \
  -H "Content-Type: application/json" \
  -d '{
    "executionId": "test-missing-001"
  }' | jq . || echo "❌ Missing fields test failed"
echo ""

echo "✅ All tests completed!"

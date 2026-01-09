import { query } from '../../config/database'
import axios from 'axios'
import config from '../../config/env'

export interface ChallengeEvaluationResult {
  input: string
  expected: string
  actual: string
  passed: boolean
}

/**
 * Executa o code_example do challenge para cada input_example e compara com o expected_output.
 * Retorna relatório de avaliação por caso de teste.
 */
export async function evaluateChallenge(challengeId: number, sessionId: string): Promise<ChallengeEvaluationResult[]> {
  // Busca código e linguagem do candidato na session_challenge_content
  const contentRes = await query(
    'SELECT content, language FROM session_challenge_content WHERE session_id = $1 AND challenge_id = $2 AND content_type = $3 LIMIT 1',
    [sessionId, challengeId, 'code']
  )
  if (contentRes.rows.length === 0) throw new Error('Código do candidato não encontrado para esta sessão/desafio')
  const candidateCode = contentRes.rows[0].content
  const candidateLang = contentRes.rows[0].language

  // Busca todos os casos de teste
  const evalRes = await query('SELECT input_example, expected_output FROM challenges_evaluations WHERE challenge_id = $1', [challengeId])
  const cases = evalRes.rows

  // Para cada caso, executa o código do candidato com o input_example e compara com o expected_output
  const results: ChallengeEvaluationResult[] = []
  for (const test of cases) {
    console.log('[evaluateChallenge] input_example do caso de teste:', test.input_example)
    // Cria registro de execução na tabela executions usando sessionId real e linguagem do candidato
    const executionId = await createExecutionRecordWithSession(sessionId, candidateLang, candidateCode)
    // Executa no runner usando o UUID
    const actualOutput = await executeInSandboxWithId(candidateCode, test.input_example, candidateLang, executionId)
    
    // Normalizar output para comparação: trim e remover quebras de linha extras
    const normalizedActual = actualOutput.trim()
    const normalizedExpected = test.expected_output.trim()
    const passed = normalizedActual === normalizedExpected
    
    console.log('[evaluateChallenge] Comparação:', {
      expected: normalizedExpected,
      actual: normalizedActual,
      passed
    })
    
    results.push({
      input: test.input_example,
      expected: test.expected_output,
      actual: actualOutput,
      passed
    })
  }
  return results
// --- Fim do arquivo ---

/**
 * Simula execução do code_example para fins de estrutura (substituir por executor real).
 */
// Cria registro de execução na tabela executions e retorna o UUID
// Cria registro de execução na tabela executions com sessionId real
async function createExecutionRecordWithSession(sessionId: string, language: string, code: string): Promise<string> {
  const result = await query(
    `INSERT INTO executions (session_id, language, code, status) VALUES ($1, $2, $3, $4) RETURNING id`,
    [sessionId, language, code, 'pending']
  )
  return result.rows[0].id
}

// Executa o runner usando o UUID gerado
async function executeInSandboxWithId(code: string, input: string, language: string, executionId: string): Promise<string> {
  try {
    let inputToSend = input
    console.log('[evaluateChallenge] Input recebido do banco:', input)
    console.log('[evaluateChallenge] Código do candidato:', code.substring(0, 100) + '...')
    
    // Garantir que o input seja sempre uma string válida (nunca undefined/null)
    if (!inputToSend || inputToSend.trim() === '') {
      console.warn('[evaluateChallenge] Input vazio! Usando valor padrão.')
      inputToSend = 'null'
    }

    // Não manipular o código - ele já deve estar pronto para receber input via stdin
    // O código do candidato já deve ter a lógica de ler de sys.stdin

    console.log('[evaluateChallenge] Enviando para runner:', {
      executionId,
      language,
      codeLength: code.length,
      input: inputToSend,
      timeout: 10000
    })

    await axios.post(`${config.runner.url}/execute`, {
      executionId,
      language,
      code,
      timeout: 10000,
      input: inputToSend // runner deve aceitar input como stdin
    })
    console.log('[evaluateChallenge] Requisição enviada ao runner com sucesso para executionId:', executionId)

    // Polling para buscar resultado consultando o banco de dados
    // O runner reporta o resultado ao backend via POST /executions/:id/report
    const maxAttempts = 40
    const delayMs = 250
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        // Consultar execução diretamente no banco de dados
        const res = await query('SELECT status, output, error FROM executions WHERE id = $1', [executionId])
        if (res.rows.length > 0) {
          const execution = res.rows[0]
          console.log(`[evaluateChallenge] Tentativa ${attempt + 1}/${maxAttempts}: status=${execution.status}`)
          
          if (execution.status === 'completed') {
            console.log(`[evaluateChallenge] Execução completada! output: ${execution.output}`)
            return execution.output || ''
          }
          if (execution.status === 'failed') {
            console.log(`[evaluateChallenge] Execução falhou! error: ${execution.error}`)
            return execution.error || 'Erro na execução'
          }
        }
      } catch (err: any) {
        console.log(`[evaluateChallenge] Tentativa ${attempt + 1}/${maxAttempts}: Erro ao consultar execução (${err.message})`)
      }
      await new Promise(resolve => setTimeout(resolve, delayMs))
    }
    console.error(`[evaluateChallenge] Timeout após ${maxAttempts} tentativas para executionId: ${executionId}`)
    return 'Timeout ao obter resultado do runner'
  } catch (err: any) {
    console.error(`[evaluateChallenge] Erro ao executar: ${err.message}`)
    return `Erro: ${err.message}`
  }
}
}

import { Groq } from "groq-sdk";

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface EvaluationMetrics {
  accuracy: number;
  relevancy: number;
  responseTime: number;
  cost: number;
  tokenCount: number;
}

interface LLMResponse {
  model: string;
  response: string;
  metrics: EvaluationMetrics;
  error?: string;
}

interface PromptAnalysis {
  type: 'objective' | 'subjective';
  expectedAnswer?: string | number;
  evaluationFunction?: (response: string) => number;
}

function analyzePrompt(prompt: string): PromptAnalysis {
  const letterCountRegex = /how many (?:of the )?(?:letter|character)s? ['"]?([a-zA-Z])['"]? (?:is|are) (?:there )?in (?:the word )?['"]?(\w+)['"]?/i;
  const letterMatch = prompt.match(letterCountRegex);
  if (letterMatch) {
    const [_, letter, word] = letterMatch;
    const correctCount = (word.toLowerCase().match(new RegExp(letter.toLowerCase(), 'g')) || []).length;
    return {
      type: 'objective',
      expectedAnswer: correctCount.toString(),
      evaluationFunction: (response: string) => {
        const numbers = response.match(/\d+/);
        if (!numbers) return 0;
        const answeredNumber = parseInt(numbers[0]);
        return answeredNumber === correctCount ? 1 : 0;
      }
    };
  }

  const wordCountRegex = /how many words (?:is|are) (?:there )?in ['"]?([^'"]+)['"]?/i;
  const wordMatch = prompt.match(wordCountRegex);
  if (wordMatch) {
    const [_, phrase] = wordMatch;
    const correctCount = phrase.trim().split(/\s+/).length;
    return {
      type: 'objective',
      expectedAnswer: correctCount.toString(),
      evaluationFunction: (response: string) => {
        const numbers = response.match(/\d+/);
        if (!numbers) return 0;
        const answeredNumber = parseInt(numbers[0]);
        return answeredNumber === correctCount ? 1 : 0;
      }
    };
  }

  const mathRegex = /what is (\d+)\s*([\+\-\*\/])\s*(\d+)/i;
  const mathMatch = prompt.match(mathRegex);
  if (mathMatch) {
    const [_, num1, operator, num2] = mathMatch;
    let correctAnswer: number;
    switch (operator) {
      case '+': correctAnswer = parseInt(num1) + parseInt(num2); break;
      case '-': correctAnswer = parseInt(num1) - parseInt(num2); break;
      case '*': correctAnswer = parseInt(num1) * parseInt(num2); break;
      case '/': correctAnswer = parseInt(num1) / parseInt(num2); break;
      default: correctAnswer = 0;
    }
    return {
      type: 'objective',
      expectedAnswer: correctAnswer.toString(),
      evaluationFunction: (response: string) => {
        const numbers = response.match(/-?\d+\.?\d*/);
        if (!numbers) return 0;
        const answeredNumber = parseFloat(numbers[0]);
        return Math.abs(answeredNumber - correctAnswer) < 0.01 ? 1 : 0;
      }
    };
  }


  return { type: 'subjective' };
}

async function evaluateWithRubric(response: string, prompt: string): Promise<{ accuracy: number; relevancy: number; details: any | null }> {
  const promptAnalysis = analyzePrompt(prompt);

  if (promptAnalysis.type === 'objective' && promptAnalysis.evaluationFunction) {
    const accuracy = promptAnalysis.evaluationFunction(response);
    const relevancy = response.match(/\d+/) ? 1 : 0;
    
    return {
      accuracy,
      relevancy,
      details: {
        expectedAnswer: promptAnalysis.expectedAnswer,
        receivedAnswer: response,
        evaluationType: 'objective'
      }
    };
  }

  const evaluationPrompt = `
Evaluate this AI response based on specific criteria. Consider:

Original Prompt: "${prompt}"
AI Response: "${response}"

Score these aspects:
1. Accuracy (0-100): How factually correct and precise is the information?
2. Relevancy (0-100): How well does it address the specific question asked?

Return ONLY a JSON object like this:
{
  "accuracy": 85,
  "relevancy": 90,
  "reasoning": "Brief explanation of scoring"
}`;

  try {
    const evaluation = await groq.chat.completions.create({
      model: "mixtral-8x7b-32768",
      messages: [
        {
          role: "system",
          content: "You are an expert evaluator. Be extremely critical and precise in your scoring."
        },
        {
          role: "user",
          content: evaluationPrompt
        }
      ],
      temperature: 0.1
    });

    const content = evaluation.choices[0]?.message?.content?.trim() || '';
    
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const scores = JSON.parse(jsonMatch[0]);
        return {
          accuracy: scores.accuracy / 100,
          relevancy: scores.relevancy / 100,
          details: {
            ...scores,
            evaluationType: 'subjective'
          }
        };
      }
    } catch (parseError) {
      console.error('Error parsing evaluation:', parseError);
    }
  } catch (error) {
    console.error('Error in evaluation:', error);
  }

  return { accuracy: 0.5, relevancy: 0.5, details: null };
}

async function getGroqResponse(prompt: string, model: string): Promise<LLMResponse> {
  const startTime = Date.now();
  try {
    console.log(`Requesting response from ${model}...`);
    
    const completion = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: model,
      temperature: 0.7,
      max_tokens: 4096,
    });

    const responseTime = (Date.now() - startTime) / 1000;
    const response = completion.choices[0]?.message?.content || '';
    const tokenCount = completion.usage?.total_tokens || 0;
    
    console.log(`${model} response received in ${responseTime}s:`, response.substring(0, 100) + '...');
    
    let costPer1kTokens = 0;
    switch (model) {
      case 'mixtral-8x7b-32768':
        costPer1kTokens = 0.027;
        break;
      case 'llama-3.3-70b-versatile':
        costPer1kTokens = 0.0007;
        break;
      case 'gemma2-9b-it':
        costPer1kTokens = 0.0001;
        break;
      case 'llama-3.1-8b-instant':
        costPer1kTokens = 0.0001;
        break;
      default:
        costPer1kTokens = 0.0001;
    }
    
    const cost = (tokenCount / 1000) * costPer1kTokens;
    
    console.log(`Evaluating response for ${model}...`);
    const evaluation = await evaluateWithRubric(response, prompt);
    console.log(`Evaluation scores for ${model}:`, evaluation);

    return {
      model: model,
      response,
      metrics: {
        accuracy: evaluation.accuracy,
        relevancy: evaluation.relevancy,
        responseTime,
        cost,
        tokenCount,
      },
    };
  } catch (error) {
    console.error(`Error with ${model}:`, error);
    const responseTime = (Date.now() - startTime) / 1000;
    return {
      model: model,
      response: '',
      metrics: {
        accuracy: 0,
        relevancy: 0,
        responseTime,
        cost: 0,
        tokenCount: 0,
      },
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function evaluatePrompt(prompt: string) {
  console.log('Starting evaluation for prompt:', prompt);
  
  const models = [
    'mixtral-8x7b-32768',
    'gemma2-9b-it',
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant'
  ];

  try {
    const responses = await Promise.all(
      models.map(model => getGroqResponse(prompt, model))
    );
    
    console.log('All evaluations completed');
    return responses;
  } catch (error) {
    console.error('Error in evaluatePrompt:', error);
    throw error;
  }
}
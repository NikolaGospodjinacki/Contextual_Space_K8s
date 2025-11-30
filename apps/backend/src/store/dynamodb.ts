// DynamoDB Store for TextBoxes
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand,
} from '@aws-sdk/lib-dynamodb';
import { TextBox } from '../types';

const TABLE_NAME = process.env.DYNAMODB_TABLE_NAME || 'contextual-space-textboxes-dev';
const REGION = process.env.AWS_REGION || 'us-east-1';

// Check if we're using DynamoDB or falling back to in-memory
const USE_DYNAMODB = process.env.USE_DYNAMODB === 'true' || process.env.DYNAMODB_TABLE_NAME !== undefined;

// DynamoDB client
const client = new DynamoDBClient({ region: REGION });
const docClient = DynamoDBDocumentClient.from(client);

// In-memory fallback for local development
let inMemoryTextBoxes: Map<string, TextBox> = new Map();

export const dynamoStore = {
  async getAllTextBoxes(): Promise<TextBox[]> {
    if (!USE_DYNAMODB) {
      return Array.from(inMemoryTextBoxes.values());
    }

    try {
      const result = await docClient.send(
        new ScanCommand({
          TableName: TABLE_NAME,
        })
      );
      return (result.Items as TextBox[]) || [];
    } catch (error) {
      console.error('DynamoDB getAllTextBoxes error:', error);
      throw error;
    }
  },

  async getTextBox(id: string): Promise<TextBox | null> {
    if (!USE_DYNAMODB) {
      return inMemoryTextBoxes.get(id) || null;
    }

    try {
      const result = await docClient.send(
        new GetCommand({
          TableName: TABLE_NAME,
          Key: { id },
        })
      );
      return (result.Item as TextBox) || null;
    } catch (error) {
      console.error('DynamoDB getTextBox error:', error);
      throw error;
    }
  },

  async createTextBox(textBox: TextBox): Promise<TextBox> {
    if (!USE_DYNAMODB) {
      inMemoryTextBoxes.set(textBox.id, textBox);
      return textBox;
    }

    try {
      await docClient.send(
        new PutCommand({
          TableName: TABLE_NAME,
          Item: {
            ...textBox,
            createdAt: textBox.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        })
      );
      return textBox;
    } catch (error) {
      console.error('DynamoDB createTextBox error:', error);
      throw error;
    }
  },

  async updateTextBox(id: string, updates: Partial<TextBox>): Promise<TextBox | null> {
    if (!USE_DYNAMODB) {
      const existing = inMemoryTextBoxes.get(id);
      if (!existing) return null;
      const updated = { ...existing, ...updates };
      inMemoryTextBoxes.set(id, updated);
      return updated;
    }

    try {
      // Build update expression dynamically
      const updateExpressions: string[] = [];
      const expressionAttributeNames: Record<string, string> = {};
      const expressionAttributeValues: Record<string, any> = {};

      Object.entries(updates).forEach(([key, value]) => {
        if (key !== 'id' && value !== undefined) {
          updateExpressions.push(`#${key} = :${key}`);
          expressionAttributeNames[`#${key}`] = key;
          expressionAttributeValues[`:${key}`] = value;
        }
      });

      // Always update the updatedAt timestamp
      updateExpressions.push('#updatedAt = :updatedAt');
      expressionAttributeNames['#updatedAt'] = 'updatedAt';
      expressionAttributeValues[':updatedAt'] = new Date().toISOString();

      const result = await docClient.send(
        new UpdateCommand({
          TableName: TABLE_NAME,
          Key: { id },
          UpdateExpression: `SET ${updateExpressions.join(', ')}`,
          ExpressionAttributeNames: expressionAttributeNames,
          ExpressionAttributeValues: expressionAttributeValues,
          ReturnValues: 'ALL_NEW',
        })
      );

      return result.Attributes as TextBox;
    } catch (error) {
      console.error('DynamoDB updateTextBox error:', error);
      throw error;
    }
  },

  async deleteTextBox(id: string): Promise<boolean> {
    if (!USE_DYNAMODB) {
      return inMemoryTextBoxes.delete(id);
    }

    try {
      await docClient.send(
        new DeleteCommand({
          TableName: TABLE_NAME,
          Key: { id },
        })
      );
      return true;
    } catch (error) {
      console.error('DynamoDB deleteTextBox error:', error);
      return false;
    }
  },

  // For local development - clear all textboxes
  async clearAll(): Promise<void> {
    if (!USE_DYNAMODB) {
      inMemoryTextBoxes.clear();
      return;
    }
    // In production, we don't want to clear the table
    console.warn('clearAll is not supported in DynamoDB mode');
  },
};

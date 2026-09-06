'use client'
import { Box, Button, Stack, TextField, Typography } from '@mui/material'
import { useState } from 'react'

export default function Home() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm ProfessorAI. Ask me about the professor reviews in the demo dataset.`,
    },
  ])
  const [message, setMessage] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async () => {
    const trimmedMessage = message.trim()
    if (!trimmedMessage || isLoading) return

    const nextMessages = [
      ...messages,
      { role: 'user', content: trimmedMessage },
    ]

    setMessage('')
    setMessages(nextMessages)
    setIsLoading(true)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ messages: nextMessages }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Unable to get a response.')
      }

      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: 'assistant',
          content: data.answer,
          sources: data.sources || [],
        },
      ])
    } catch (error) {
      setMessages((currentMessages) => [
        ...currentMessages,
        {
          role: 'assistant',
          content: error.message || 'Something went wrong. Please try again.',
        },
      ])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Box
      width="100vw"
      height="100vh"
      display="flex"
      flexDirection="column"
      justifyContent="center"
      alignItems="center"
      sx={{
        background: 'linear-gradient(135deg, #1f1c2c 0%, #928dab 100%)',
      }}
    >
      <Typography
        variant="h4"
        color="white"
        sx={{
          fontFamily: '"Raleway", sans-serif',
          marginBottom: '20px',
          textShadow: '2px 2px 4px rgba(0,0,0,0.5)',
        }}
      >
        ProfessorAI
      </Typography>
      <Stack
        direction={'column'}
        width="500px"
        maxWidth="calc(100vw - 32px)"
        height="700px"
        maxHeight="calc(100vh - 120px)"
        borderRadius="16px"
        p={2}
        spacing={3}
        sx={{
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          boxShadow: '0px 0px 30px rgba(0, 0, 0, 0.5)',
        }}
      >
        <Stack
          direction={'column'}
          spacing={2}
          flexGrow={1}
          overflow="auto"
          maxHeight="100%"
        >
          {messages.map((chatMessage, index) => (
            <Box
              key={index}
              display="flex"
              justifyContent={
                chatMessage.role === 'assistant' ? 'flex-start' : 'flex-end'
              }
            >
              <Box
                sx={{
                  backgroundColor:
                    chatMessage.role === 'assistant'
                      ? 'rgba(33, 150, 243, 0.8)'
                      : 'rgba(156, 39, 176, 0.8)',
                  color: 'white',
                  borderRadius: '16px',
                  p: 2,
                  maxWidth: '80%',
                  wordWrap: 'break-word',
                  boxShadow: '0px 0px 10px rgba(0, 0, 0, 0.2)',
                }}
              >
                {chatMessage.content}
              </Box>
            </Box>
          ))}
          {isLoading && (
            <Typography color="white" variant="body2">
              Searching reviews...
            </Typography>
          )}
        </Stack>
        <Stack direction={'row'} spacing={2}>
          <TextField
            label="Ask about a professor"
            fullWidth
            value={message}
            disabled={isLoading}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                sendMessage()
              }
            }}
            sx={{
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
              borderRadius: '8px',
              input: {
                color: 'white',
              },
            }}
          />
          <Button
            variant="contained"
            onClick={sendMessage}
            disabled={isLoading || !message.trim()}
            sx={{
              backgroundColor: '#21a1f1',
              ':hover': {
                backgroundColor: '#1e88e5',
              },
            }}
          >
            Send
          </Button>
        </Stack>
      </Stack>
    </Box>
  )
}

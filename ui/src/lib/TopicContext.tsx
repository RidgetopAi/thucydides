import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { api } from './api';

interface TopicContextValue {
  topic: string;
  setTopic: (topic: string) => void;
  topics: string[];
}

const TopicContext = createContext<TopicContextValue>({
  topic: '',
  setTopic: () => {},
  topics: [],
});

export function useTopic() {
  return useContext(TopicContext);
}

export function TopicProvider({ children }: { children: ReactNode }) {
  const [topics, setTopics] = useState<string[]>([]);
  const [topic, setTopicState] = useState(() => localStorage.getItem('thuc-topic') || '');

  useEffect(() => {
    api.topics().then((data) => setTopics(data.topics));
  }, []);

  const setTopic = (value: string) => {
    setTopicState(value);
    if (value) localStorage.setItem('thuc-topic', value);
    else localStorage.removeItem('thuc-topic');
  };

  return (
    <TopicContext.Provider value={{ topic, setTopic, topics }}>
      {children}
    </TopicContext.Provider>
  );
}

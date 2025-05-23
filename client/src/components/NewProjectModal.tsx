import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Project } from "@shared/schema";

interface NewProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateProject: (project: Project) => void;
}

const PROJECT_TYPES = [
  "Article",
  "Blog Post",
  "Research Paper",
  "Creative Writing",
  "Business Document",
  "Custom"
];

const WRITING_STYLES = [
  "Professional",
  "Creative",
  "Academic",
  "Conversational",
  "Technical",
  "Custom"
];

export default function NewProjectModal({
  isOpen,
  onClose,
  onCreateProject
}: NewProjectModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [projectName, setProjectName] = useState("");
  const [projectType, setProjectType] = useState("Article");
  const [writingStyle, setWritingStyle] = useState("Professional");
  const [useTemplate, setUseTemplate] = useState(false);
  
  // Create project mutation
  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const projectData = {
        userId: 1, // Default user
        name: projectName.trim(), // Ensure trimmed name
        type: projectType,
        style: writingStyle
      };
      
      console.log("Sending project data:", projectData); // Debug log
      
      const res = await apiRequest("POST", "/api/projects", projectData);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      
      toast({
        title: "Project created",
        description: "Your new project has been created successfully."
      });
      
      // Create a default document for the project
      createDocumentMutation.mutate(data.id);
    },
    onError: (error) => {
      console.error("Project creation error:", error); // Debug log
      
      toast({
        title: "Failed to create project",
        description: error.message || "Please check your input and try again.",
        variant: "destructive"
      });
    }
  });
  
  // Create document mutation
  const createDocumentMutation = useMutation({
    mutationFn: async (projectId: number) => {
      const res = await apiRequest("POST", "/api/documents", {
        projectId,
        title: "Untitled Document",
        content: ""
      });
      return res.json();
    },
    onSuccess: (data, projectId) => {
      queryClient.invalidateQueries({ queryKey: [`/api/projects/${projectId}/documents`] });
      
      // Pass the new project data to the parent component
      const project = createProjectMutation.data;
      if (project) {
        onCreateProject(project);
      }
      
      // Reset form
      setProjectName("");
      setProjectType("Article");
      setWritingStyle("Professional");
      setUseTemplate(false);
    }
  });
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const trimmedName = projectName.trim();
    
    if (!trimmedName) {
      toast({
        title: "Missing project name",
        description: "Please enter a name for your project.",
        variant: "destructive"
      });
      return;
    }
    
    console.log("Form validation passed:", { 
      name: trimmedName, 
      type: projectType, 
      style: writingStyle 
    }); // Debug log
    
    createProjectMutation.mutate();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create New Project</DialogTitle>
          <DialogDescription>
            Set up a new writing project with your preferred settings.
          </DialogDescription>
        </DialogHeader>
        
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="project-name">Project Name</Label>
              <Input
                id="project-name"
                placeholder="Enter project name..."
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="project-type">Project Type</Label>
              <Select value={projectType} onValueChange={setProjectType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select project type" />
                </SelectTrigger>
                <SelectContent>
                  {PROJECT_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label>Writing Style</Label>
              <div className="grid grid-cols-3 gap-2">
                {WRITING_STYLES.map((style) => (
                  <Button
                    key={style}
                    type="button"
                    variant={writingStyle === style ? "default" : "outline"}
                    className={writingStyle === style ? "bg-primary text-white" : ""}
                    onClick={() => setWritingStyle(style)}
                  >
                    {style}
                  </Button>
                ))}
              </div>
            </div>
            
            <div className="flex items-center space-x-2 pt-2">
              <Checkbox
                id="use-template"
                checked={useTemplate}
                onCheckedChange={(checked) => setUseTemplate(checked as boolean)}
              />
              <Label htmlFor="use-template" className="text-sm text-gray-700 dark:text-gray-300">
                Create from template
              </Label>
            </div>
          </div>
          
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={createProjectMutation.isPending || createDocumentMutation.isPending}
            >
              {(createProjectMutation.isPending || createDocumentMutation.isPending) ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
